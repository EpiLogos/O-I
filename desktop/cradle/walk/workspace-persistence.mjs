import {chromium} from "playwright";
import assert from "node:assert/strict";

const baseUrl = process.env.WALK_URL ?? "http://localhost:4173";
const browser = await chromium.launch({headless: true, executablePath: process.env.WALK_CHROMIUM_EXECUTABLE});
const page = await browser.newPage({viewport: {width: 1422, height: 858}});
await page.addInitScript(() => {
  window.__OI_KERNEL_BRIDGE__ = "http://127.0.0.1:4179";
  sessionStorage.setItem("oi-cradle.welcome.v1", "1");
  localStorage.removeItem("oi-cradle.workspaces.v1");
});
try {
  await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  await page.locator('footer[aria-label="Workspace status"]').waitFor({state: "attached"});
  const actions = page.getByLabel("Workspace actions");
  await actions.focus();
  await page.keyboard.press("Enter");
  const create = page.getByRole("button", {name: "New workspace", exact: true});
  await create.waitFor();
  await create.click();
  await page.getByRole("textbox", {name: "Workspace name"}).fill("Lifecycle proof");
  await page.getByRole("button", {name: "Create workspace", exact: true}).click();
  const workspace = page.getByRole("combobox", {name: "Workspace"});
  await page.waitForFunction(() => [...document.querySelectorAll('select[aria-label="Workspace"] option')].some(option => option.textContent === "Lifecycle proof"));
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1") ?? "null"));
  const created = saved?.workspaces.find((entry) => entry.name === "Lifecycle proof");
  assert.ok(created, "pagehide persisted the newly created workspace");
  await page.reload({waitUntil: "domcontentloaded"});
  await page.locator('footer[aria-label="Workspace status"]').waitFor({state: "attached"});
  await page.getByRole("combobox", {name: "Workspace"}).selectOption(created.id);
  assert.equal(await page.getByRole("combobox", {name: "Workspace"}).inputValue(), created.id);
  console.log(JSON.stringify({checks: ["new workspace", "pagehide flush", "reload restore"], workspace: created.name}));
} finally {
  await browser.close();
}
