// S8 polish verification — scratch script (not the walk runner; other
// agents own ports 4173/4179/4189 right now, this only reads the running
// dev server at :1423 over the shared bridge). Confirms sidebar/material/
// system/agent polish and captures the required screenshot set.
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
  await page.waitForTimeout(500);

  // --- Sidebar: default (chats) state, findings 18/19/26/27 ---
  ok("World navigator present", await page.getByRole("complementary", { name: "World navigator" }).count());
  ok("No standalone 'Select a project...' hint between PROJECTS and the list (finding 26)",
    (await page.locator(".project-availability", { hasText: "Select a project to read its chats and tasks." }).count()) === 0);
  await shot(page, "s8-sidebar-default-1280");

  // --- Sidebar: files mode on a real project (folder/file alignment, finding 27) ---
  const oiRow = page.locator('[data-project-path="Work/O-I"]');
  if (await oiRow.count()) {
    await oiRow.click();
    await page.waitForTimeout(400);
    if ((await page.getByRole("button", { name: "O-I: files", exact: true }).getAttribute("aria-pressed")) !== "true") {
      await page.getByRole("button", { name: "O-I: files", exact: true }).click();
      await page.waitForTimeout(400);
    }
    await shot(page, "s8-sidebar-files-1280");
    const align = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".native-directory > li > button"));
      const lefts = rows.slice(0, 8).map(b => b.querySelector("svg")?.getBoundingClientRect().left);
      return new Set(lefts).size <= 1;
    });
    ok("Folder and file glyphs share one left edge (finding 27)", align);
  }

  // --- Sidebar: chats mode + selected-encounter wash (C6) ---
  if (await oiRow.count()) {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("aria-label") === "O-I: chats and tasks");
      btn?.click();
    });
    await page.waitForTimeout(600);
    await shot(page, "s8-sidebar-chats-1280");
    const row = page.locator(".encounter-row").first();
    if (await row.count()) {
      await row.hover();
      await page.waitForTimeout(150);
      const hoverBg = await row.evaluate(el => getComputedStyle(el).backgroundColor);
      ok("Encounter row has a hover wash (--oi-wash)", hoverBg !== "rgba(0, 0, 0, 0)");
      await row.click();
      await page.waitForTimeout(800);
      const current = await page.evaluate(() => document.querySelector(".encounter-row")?.getAttribute("aria-current"));
      ok("Active encounter's sidebar row carries aria-current (activeEncounterRef threaded, finding C6)", current === "true");
      await shot(page, "s8-sidebar-selected-encounter-1280");
      await page.keyboard.press("Escape");
    }
  }

  // --- Sidebar: wiki mode ---
  const centralRow = page.locator('[data-project-path="Work/Central"]');
  if (await centralRow.count()) {
    await centralRow.click();
    await page.waitForTimeout(400);
    const wikiBtn = page.getByRole("button", { name: "Central: wiki", exact: true }).first();
    if (await wikiBtn.count()) {
      await wikiBtn.click();
      await page.waitForTimeout(400);
      await shot(page, "s8-sidebar-wiki-1280");
    }
  }

  // --- Material: markdown rendered/source segmented toggle (findings 16/17) ---
  const readme = page.locator('[data-file-path="Work/O-I/README.md"]');
  if (await readme.count()) {
    await readme.click();
    await page.waitForTimeout(700);
    ok("Material chrome shows path + format meta (finding 17)", await page.locator(".material-path").count() > 0 && await page.locator(".material-format").count() > 0);
    const toggle = await page.evaluate(() => {
      const t = document.querySelector(".material-toggle");
      if (!t) return null;
      const cs = getComputedStyle(t);
      return { bg: cs.backgroundColor, radius: cs.borderRadius, border: cs.border };
    });
    ok("Segmented control: pane-bar ground + hairline + radius 5 (finding 16)",
      !!toggle && toggle.radius === "5px" && toggle.border.includes("1px"));
    await shot(page, "s8-material-markdown-rendered-1280");
    await page.getByRole("tab", { name: "Source" }).click();
    await page.waitForTimeout(400);
    await shot(page, "s8-material-markdown-source-1280");
    const selectedStyle = await page.evaluate(() => {
      const b = document.querySelector('.material-toggle button[aria-selected="true"]');
      const cs = b ? getComputedStyle(b) : null;
      return cs ? { bg: cs.backgroundColor, shadow: cs.boxShadow } : null;
    });
    ok("Selected segment on --oi-sidebar-ground with a shadow (finding 16)",
      !!selectedStyle && selectedStyle.bg === "rgb(245, 246, 240)" && selectedStyle.shadow !== "none");
    await page.getByRole("tab", { name: "Rendered" }).click();
    await page.waitForTimeout(300);
  }

  // --- Material: unsupported binary honest disposition (unchanged text) ---
  // (best-effort: only if such a file exists in the real tree already open via sidebar walk fixtures)

  // --- System surface: observed stamp, no NaNd (finding: SystemPanel) ---
  await page.evaluate(() => document.querySelector('button[aria-label]')); // no-op settle
  const systemBtn = page.getByRole("button", { name: "System" });
  if (await systemBtn.count()) {
    await systemBtn.click();
    await page.waitForTimeout(1200);
    await shot(page, "s8-system-panel-1280");
    const bodyText = await page.locator(".system-panel").innerText();
    ok("System panel never renders 'NaNd ago'", !bodyText.includes("NaNd"));
    ok("System panel shows a real 'Observed ...' stamp when finite", /Observed \d|Observed just now/.test(bodyText));
  }

  // --- Agent no-encounter state: Gateway absence line ---
  const toggleRight = page.getByRole("button", { name: "Toggle right region" });
  if (await toggleRight.count()) {
    await toggleRight.click();
    await page.waitForTimeout(500);
    await shot(page, "s8-agent-no-encounter-1280");
    const gatewayText = await page.locator(".agent-empty").innerText().catch(() => "");
    ok("Agent no-encounter state shows the Gateway absence line", gatewayText.includes("No owner operation is exposed to the desktop yet. See System."));
  }

  // --- 900x760 pass ---
  await page.setViewportSize({ width: 900, height: 760 });
  await page.waitForTimeout(400);
  await shot(page, "s8-sidebar-900");
  if (await readme.count()) {
    await readme.click();
    await page.waitForTimeout(600);
    await shot(page, "s8-material-900");
  }

  console.log("\n--- summary ---");
  const failed = results.filter(r => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILED:", failed.map(f => f.label));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
