import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const url = process.env.WALK_URL || "http://localhost:4173";
const browser = await chromium.launch({ executablePath: process.env.WALK_CHROMIUM_EXECUTABLE, headless: true });
const page = await browser.newPage({ viewport: { width: 1422, height: 858 } });
const checks = [];
const errors = [];
const check = (value, name) => { assert.ok(value, name); checks.push(name); console.log("PASS", name); };
page.on("pageerror", (error) => errors.push(String(error)));
await page.addInitScript(() => {
  window.__OI_KERNEL_BRIDGE__ = "http://127.0.0.1:4179";
  sessionStorage.setItem("oi-cradle.welcome.v1", "1");
});
try {
  await page.goto(url);
  await page.getByRole("button", { name: "O-I", exact: true }).click();
  await page.getByRole("navigation", { name: "O-I work", exact: true }).getByRole("button", { name: "Agents", exact: true }).click();
  const catalogue = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:4179/op", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "central_actions_read" }) });
    return await response.json();
  });
  const actions = catalogue?.outcome?.data?.actions;
  check(catalogue?.ok === true && catalogue?.outcome?.result === "central_actions_reading" && Array.isArray(actions), "Reads the live Central Action catalogue");
  check(!actions.some((entry) => entry?.id === "agent-profile.express"), "Confirms Agent expression is unavailable in the live catalogue");
  const agents = page.getByRole("region", { name: "Project Agents" });
  await agents.waitFor();
  check(await agents.getByRole("heading", { name: "Agents", exact: true }).count() === 1, "Opens the Project Agents workspace");
  await agents.getByText("No AgentProfiles are authored in the disclosed scopes.", { exact: true }).waitFor();
  check(await agents.getByText("No AgentProfiles are authored in the disclosed scopes.", { exact: true }).count() === 1, "Shows truthful empty profile inventory");
  check(await agents.getByText("No AgentSets are authored in the disclosed scopes.", { exact: true }).count() === 1, "Shows truthful empty team inventory");
  check(await agents.getByText("Current sessions", { exact: true }).count() === 1, "Shows current Project sessions separately");
  check(await agents.getByText("Express an AgentProfile intent", { exact: true }).count() === 0, "Hides unsupported expression affordance");
  const workspace = agents.getByText("Workspace settings", { exact: true });
  check(await workspace.count() === 1, "Offers workspace controls as secondary settings");
  check(await workspace.locator("xpath=..").evaluate((element) => !element.open), "Workspace settings starts collapsed");
  check(await agents.getByText("World lookup unavailable", { exact: true }).count() === 0, "Does not surface irrelevant World errors");
  check(errors.length === 0, "No application page errors");
  await page.screenshot({ path: "walk/artifacts/agent-roster-ui-20260914.png" });
  writeFileSync("walk/artifacts/agent-roster-ui-20260914.json", JSON.stringify({ standing: "C: live browser and Central action catalogue; no populated Agent records or expression capability", checks, errors }, null, 2));
} finally {
  await browser.close();
}
