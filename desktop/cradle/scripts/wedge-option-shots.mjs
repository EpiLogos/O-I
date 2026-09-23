// Throwaway render pass for the wedge proposal (ProjectCentral/now/flows/
// wedge-reauthoring-proposal-2026-09-23.md): the REAL built app, with one
// clip-path rule overridden per option. Nothing here is committed except
// the screenshots it emits.
import { chromium } from "playwright";

const base = process.env.SHOT_URL ?? "http://127.0.0.1:4177/";
const out = process.env.SHOT_DIR ?? "../../ProjectCentral/now/flows/";

const variants = {
  "wedge-option-a.png": null, // the state on the branch — no override
  "wedge-option-b.png": `
.desktop-shell .desktop-centre :is([data-window-corner="true"], [data-window-corner-left="true"]){
  clip-path:polygon(var(--window-cutout) 0,calc(100% - var(--window-cutout-right)) 0,100% var(--window-corner-depth),100% 100%,0 100%,0 var(--window-corner-depth-left));
}`,
  "wedge-option-c.png": `
.desktop-shell .desktop-centre :is([data-window-corner="true"], [data-window-corner-left="true"]){
  clip-path:polygon(calc(var(--window-cutout)) 0,calc(100% - var(--window-cutout-right)) 0,100% var(--window-corner-depth),100% 100%,0 100%,0 calc(var(--window-corner-depth-left) - 10px),10px var(--window-corner-depth-left),var(--window-cutout) var(--window-corner-depth-left));
}
.desktop-shell .desktop-centre [data-window-corner="true"]{
  clip-path:polygon(var(--window-cutout) 0,calc(100% - var(--window-cutout-right)) 0,calc(100% - var(--window-cutout-right)) calc(var(--window-corner-depth) - 10px),calc(100% - 10px) var(--window-corner-depth),100% 100%,0 100%,0 var(--window-corner-depth-left),var(--window-cutout) var(--window-corner-depth-left));
}`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
// The opening field's own law: reduced motion paints the final state once
// and releases — the honest fast path for a screenshot pass.
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector(".desktop-shell", { timeout: 30000 });
// The opening field: "Click anywhere to open" — enter, then let the
// workspace compose before shooting the corner (the flight finishes on
// simulation progress, not on a timer).
await page.mouse.click(640, 400);
await page.waitForSelector('[data-region="left"]', { timeout: 30000 });
await page.waitForSelector(".welcome-prompt, .desktop-shell[data-mode]", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(4000);
// The corner cut lives on mode stages and pane groups (tab-strip carriers) —
// open a flow so a pane group presents the corner, then shoot it.
const write = page.getByRole("button", { name: "Start writing", exact: true });
if (await write.count()) {
  await write.click();
  await page.locator('[data-window-corner-left="true"] i, [data-window-corner-left="true"]').first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
// The left corner cut only manifests when the canvas reaches the window's
// left edge (the reserve is spent against the open sidebar otherwise) —
// close the left region with its own toggle, the law's own context.
await page.getByRole("button", { name: "Toggle left region" }).click();
await page.waitForTimeout(800);
// Dark appearance so the cut reads against the ground (the light canvas card
// swallows the notch); the attribute is the host's own appearance toggle.
await page.evaluate(() => { const el = document.querySelector(".oi-desktop"); if (el) el.setAttribute("data-theme", "dark"); });
await page.waitForTimeout(600);
for (const [file, css] of Object.entries(variants)) {
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(250);
  await page.screenshot({ path: out + file, clip: { x: 0, y: 0, width: 400, height: 120 } });
  console.log("shot:", file);
}
await browser.close();
