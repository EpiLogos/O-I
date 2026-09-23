// Diagnostic only (never acceptance): open the running walk preview against a
// running bridge, bind the given ground, enter Settings and screenshot each
// place. Usage: node walk/look.diagnostic.mjs <root> <outdir> [places…]
import {chromium} from "playwright";
import {bindDefaultCentral} from "./editor-doc.mjs";
const [root, out, ...places] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await (await browser.newContext({viewport: {width: 1440, height: 900}})).newPage();
const logs = [];
page.on("console", (message) => logs.push(`${message.type()}: ${message.text()}`));
await page.addInitScript(() => { window.__OI_KERNEL_BRIDGE__ = "http://127.0.0.1:4579"; try { sessionStorage.setItem("oi-cradle.welcome.v1", "walk-continuing-session"); } catch {} });
await page.goto("http://localhost:4573/");
if (root && root !== "-") await bindDefaultCentral(page, root).catch((error) => logs.push(`bind: ${error}`));
await page.keyboard.press("Meta+Alt+Digit5");
await page.waitForTimeout(1500);
for (const place of places.length ? places : ["status"]) {
  const [kind, id] = place.includes(":") ? place.split(":") : ["section", place];
  const target = kind === "product" ? `[data-settings-product="${id}"]` : `[data-settings-section="${id}"]`;
  await page.locator(target).first().click().catch((error) => logs.push(`click ${place}: ${error}`));
  await page.waitForTimeout(6000);
  await page.screenshot({path: `${out}/${place.replace(":", "-")}.png`});
}
console.log(logs.filter((line) => !line.startsWith("debug")).slice(-30).join("\n"));
await browser.close();
