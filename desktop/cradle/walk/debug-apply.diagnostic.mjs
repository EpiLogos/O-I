// Diagnostic only: stage a skill + connection in the running dev world, apply, dump what remains staged.
import {chromium} from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({viewport: {width: 1280, height: 820}})).newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text()); });
await page.addInitScript(() => { window.__OI_KERNEL_BRIDGE__ = "http://127.0.0.1:4579"; try { sessionStorage.setItem("oi-cradle.welcome.v1", "x"); } catch {} });
await page.goto("http://localhost:4573/");
await page.locator(".world-system-settings").first().click();
await page.locator('[data-settings-section="skills"]').click();
await page.locator('[data-skill="skill/walkskills/walk-gamma"] [role=switch]').waitFor({timeout: 300000});
await page.locator('[data-skill="skill/walkskills/walk-gamma"] [role=switch]').click();
await page.locator("[data-settings-pending]").waitFor({timeout: 300000});
await page.locator("[data-settings-review]").click();
await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "ready", null, {timeout: 300000});
await page.locator("[data-review-apply]").click();
await page.waitForFunction(() => document.querySelector("[data-settings-review-sheet]")?.getAttribute("data-phase") === "done", null, {timeout: 300000});
console.log("after apply:", await page.locator("[data-settings-review-sheet]").innerText());
await page.locator("[data-review-close]").click();
await page.waitForTimeout(3000);
console.log("strip:", await page.locator("[data-settings-pending]").count() ? await page.locator("[data-settings-pending]").innerText() : "absent");
if (await page.locator("[data-settings-pending]").count()) { await page.locator("[data-settings-review]").click(); await page.waitForTimeout(8000); console.log("pending review:", await page.locator("[data-settings-review-sheet]").innerText()); }
await browser.close();
