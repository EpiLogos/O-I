// S7 polish verification — scratch script (not the walk runner; other
// agents own port 4179 right now). Confirms the required labels still
// resolve and captures the required screenshot set for the polish round.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = here; // walk/artifacts/fnd
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:1423/";

const results = [];
function ok(label, value) {
  results.push({ label, ok: !!value });
  console.log(`${value ? "OK  " : "FAIL"} ${label}`);
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`shot: ${name}.png`);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForSelector(".world-navigator", { timeout: 20000 });
  await page.waitForTimeout(400);

  // --- label resolution check (required selectors) ---
  ok("role button 'Toggle right region'", await page.getByRole("button", { name: "Toggle right region" }).count());

  // Collapse left to check 'Collapse left region' -> then 'Toggle left region' appears in the workbench bar once collapsed.
  const collapseLeft = page.getByRole("button", { name: "Collapse left region" });
  ok("role button 'Collapse left region' (before collapse)", await collapseLeft.count());
  await collapseLeft.click();
  await page.waitForTimeout(300);
  ok("role button 'Toggle left region' (after collapse)", await page.getByRole("button", { name: "Toggle left region" }).count());
  await page.getByRole("button", { name: "Toggle left region" }).click();
  await page.waitForTimeout(300);

  // Right region: open panel, then full/collapse controls.
  await page.getByRole("button", { name: "Toggle right region" }).click();
  await page.waitForTimeout(400);
  await shot(page, "s7-agent-side-conversation-1280");
  ok("navigation 'Right region planes'", await page.getByRole("navigation", { name: "Right region planes" }).count());
  const fullBtn = page.getByRole("button", { name: "Full right region" });
  ok("role button 'Full right region'", await fullBtn.count());
  await fullBtn.click();
  await page.waitForTimeout(400);
  await shot(page, "s7-agent-full-1280");
  ok("role button 'Collapse right region'", await page.getByRole("button", { name: "Collapse right region" }).count());
  const restoreBtn = page.getByRole("button", { name: "Restore right region" });
  ok("role button 'Restore right region' (full state)", await restoreBtn.count());
  await restoreBtn.click();
  await page.waitForTimeout(400);

  // Agent planes: Activity / Context / Inspect.
  const planesNav = page.getByRole("navigation", { name: "Right region planes" });
  for (const plane of ["Activity", "Context", "Inspect", "Conversation"]) {
    await planesNav.getByRole("button", { name: plane, exact: true }).click();
    await page.waitForTimeout(250);
    await shot(page, `s7-agent-plane-${plane.toLowerCase()}-1280`);
  }
  await page.getByRole("button", { name: "Collapse right region" }).click();
  await page.waitForTimeout(300);

  // Region 'Empty workspace' + textbox 'Writing surface' (rest state).
  ok("region 'Empty workspace'", await page.getByRole("region", { name: "Empty workspace" }).count());
  await shot(page, "s7-rest-1280");
  await page.getByRole("button", { name: /Start writing|Resume writing/ }).click();
  await page.waitForTimeout(300);
  const writing = page.getByRole("textbox", { name: "Writing surface" });
  ok("textbox 'Writing surface'", await writing.count());
  await writing.fill("Polish round s7 verification.");
  await shot(page, "s7-writing-1280");
  await page.getByRole("button", { name: "Back to workspace" }).click();
  await page.waitForTimeout(300);

  // Open two files, split, check .tab / .pane.group / .source-textarea / workspace select.
  await page.locator('[data-project-path="Work/O-I"]').click();
  await page.waitForTimeout(300);
  const filesToggle = page.getByRole("button", { name: "O-I: files", exact: true });
  if (await filesToggle.count()) { await filesToggle.click(); await page.waitForTimeout(300); }
  await page.locator('[data-file-path="Work/O-I/README.md"]').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('[data-file-path="Work/O-I/surfaces.json"]').click().catch(() => {});
  await page.waitForTimeout(400);
  ok(".tab present", await page.locator(".tab").count());
  ok(".pane.group present", await page.locator(".pane.group").count());
  ok(".source-textarea present", await page.locator(".source-textarea").count());
  ok('.canvas-arrangement select[aria-label="Workspace"]', await page.locator('.canvas-arrangement select[aria-label="Workspace"]').count());
  await shot(page, "s7-split-1280");

  // Maximize -> pill.
  await page.keyboard.press("Meta+Alt+Enter");
  await page.waitForTimeout(300);
  await shot(page, "s7-maximized-1280");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ⌘K search overlay.
  await page.getByRole("button", { name: "Search", exact: false }).first().click().catch(async () => { await page.keyboard.press("Meta+k"); });
  await page.waitForTimeout(400);
  await shot(page, "s7-search-overlay-1280");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Wiki-open failure (SemanticWiki provider absent) — the honest refusal
  // must show visibly in the navigator right where the person clicked.
  const centralWiki = page.locator("button.central-wiki-entry");
  if (await centralWiki.count()) {
    await centralWiki.click({ force: true });
    await page.waitForFunction(() => document.querySelector('[role="alert"]'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(200);
    ok("role alert visible after wiki-open failure", await page.getByRole("alert").count());
    await shot(page, "s7-wiki-open-failure-1280");
  }

  // Responsive tiers.
  await page.setViewportSize({ width: 900, height: 760 });
  await page.waitForTimeout(400);
  await shot(page, "s7-responsive-900");
  await page.setViewportSize({ width: 700, height: 760 });
  await page.waitForTimeout(400);
  await shot(page, "s7-responsive-700");
  await context.close();

  // First-load sidebar width — fresh context, screenshot immediately after
  // the navigator mounts (no user interaction in between).
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const freshPage = await fresh.newPage();
  await freshPage.goto(BASE);
  await freshPage.waitForSelector(".world-navigator", { timeout: 20000 });
  await shot(freshPage, "s7-first-load-sidebar-1280");
  const w = await freshPage.evaluate(() => document.querySelector(".desktop-side.left")?.getBoundingClientRect().width);
  ok(`first paint sidebar width is the persisted 240px (measured ${w})`, w && Math.abs(w - 240) < 2);
  await fresh.close();
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) { console.log("FAILED:", failed.map(f => f.label)); process.exitCode = 1; }
