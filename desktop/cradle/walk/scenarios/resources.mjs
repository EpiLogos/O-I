/**
 * resources — S6 resource/lifecycle measurement (feeding FND-06), against
 * the "Memory acceptance", "View disposal", "State and cache lifetime" and
 * "Loading scope" rows of the cradle-rebuild self/other field-UX contract
 * (.superpowers/sdd/cradle-rebuild/SELF-OTHER-FIELD-UX-2026-09-08.md,
 * "Foundation engineering — first execution rounds").
 *
 * Drives real repeated cycles against a RUNNING app (dev server + kernel
 * bridge, not a fresh walk build) and records numbers, never prose:
 *   1. open a file tab from the sidebar Files mode -> close it (Meta+W)
 *   2. open two files, split right (Meta+D), maximize (Meta+Alt+Enter),
 *      restore (Escape), close both
 *   3. open the project wiki (<Project>: wiki -> neighbourhood), pan the
 *      graph via keyboard arrows 10x, zoom in/out, close
 *   4. toggle the right region (Meta+Shift+B) open/closed and full
 *      (Meta+Alt+J)/Escape
 *   5. switch between two open tabs 20x
 *
 * The ground is the REAL Central world the already-running walk bridge
 * serves (Kernel::discover() from the cradle cwd) — this scenario never
 * provisions a fixture project. It only ever opens real, existing,
 * read-only files (README.md, docs/*.md) under Work/O-I. It never types
 * into an editable surface and never saves.
 *
 * Two ways to run it:
 *
 *   standalone (this round — while walk/run.mjs registration is owned by
 *   another agent this round):
 *     node walk/scenarios/resources.mjs \
 *       --url http://localhost:1423 --bridge http://127.0.0.1:4179 \
 *       --cycles 20 --out walk/artifacts/resources.json
 *
 *   once registered in walk/run.mjs's SCENARIOS map, the same
 *   `export default async function run(ctx)` is invoked with the standard
 *   harness ctx ({page, baseUrl, bridgeUrl, check, shot, metric,
 *   artifactsDir, log, ...}) — cycles/outPath then fall back to their
 *   defaults (20 cycles, <artifactsDir>/resources.json).
 *
 * Warm-up: the first 3 cycles run the same steps but are not sampled — the
 * CDP session (Performance.getMetrics) is attached only after warm-up, so
 * per_cycle[] holds cycles 4..N. growth_per_cycle is a linear fit over
 * those sampled cycles for JS heap and DOM node count. The verdict is
 * reported honestly from the fit — never masked by reloading mid-run.
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = "O-I";
const FILE_A = { path: "README.md", name: "README.md" };
const FILE_B = { path: "docs/ARCHITECTURE.md", name: "ARCHITECTURE.md" };
const WARMUP_CYCLES = 3;
const TAB_SWITCH_REPEATS = 20;
const GRAPH_PAN_REPEATS = 10;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttr(value) {
  return value.replace(/"/g, '\\"');
}

async function waitForLocatorCount(locator, expected, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const count = await locator.count();
    if (count === expected) return;
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for locator count === ${expected} (last saw ${count})`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** True read helpers only — never fill/type/save. */
async function ensureProjectMode(page, project, mode) {
  const button = page.getByRole("button", { name: `${project}: ${mode}`, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
}

async function ensureProjectExpanded(nav, name) {
  // The disclosure control can be momentarily absent right after selecting
  // a project the navigator has not yet fetched — poll rather than take a
  // single point-in-time snapshot (Locator#count never waits on its own).
  const collapseBtn = nav.getByRole("button", { name: `Collapse ${name}`, exact: true });
  const expandBtn = nav.getByRole("button", { name: `Expand ${name}`, exact: true });
  const deadline = Date.now() + 10_000;
  for (;;) {
    if ((await collapseBtn.count()) > 0) return;
    if ((await expandBtn.count()) > 0) {
      await expandBtn.click();
      return;
    }
    if (Date.now() > deadline) throw new Error(`project "${name}" disclosure control never appeared`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function ensureFolderExpanded(container, folderName) {
  const collapseBtn = container.getByRole("button", { name: `Collapse folder ${folderName}`, exact: true });
  const expandBtn = container.getByRole("button", { name: `Expand folder ${folderName}`, exact: true });
  const deadline = Date.now() + 10_000;
  for (;;) {
    if ((await collapseBtn.count()) > 0) return;
    if ((await expandBtn.count()) > 0) {
      await expandBtn.click();
      return;
    }
    if (Date.now() > deadline) throw new Error(`folder "${folderName}" disclosure control never appeared`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function openFile(page, nav, file) {
  await nav.locator(`[data-file-path="Work/${escapeAttr(PROJECT)}/${escapeAttr(file.path)}"]`).click();
  await page
    .getByRole("textbox", { name: new RegExp(`^(Reading|Editing) ${escapeRegExp(file.name)}$`) })
    .waitFor({ timeout: 10_000 });
}

async function closeAllTabs(page) {
  for (let guard = 0; guard < 12; guard++) {
    const tabs = page.locator(".tab");
    const count = await tabs.count();
    if (count === 0) return;
    await tabs.first().click();
    await page.keyboard.press("Meta+w");
    await page.waitForFunction(
      (prev) => document.querySelectorAll(".tab").length < prev,
      count,
      { timeout: 10_000 },
    );
  }
  throw new Error("closeAllTabs exceeded its guard without reaching zero open tabs");
}

async function rightRegionDepth(page) {
  return page.evaluate(() => document.querySelector('[data-region="right"]')?.getAttribute("data-depth") ?? null);
}

/** One full real cycle — the five steps from the brief, in order. Each
 * step is wrapped so one broken step (e.g. the shell mid-restyle) does not
 * abort the whole cycle; failures are collected and returned honestly. */
async function runCycle(page, nav, issues, cycleIndex, artifactsDir) {
  const note = (step, error) => {
    issues.push({ cycle: cycleIndex, step, error: String(error?.message ?? error) });
    if (artifactsDir) {
      page
        .screenshot({ path: join(artifactsDir, `resources-debug-c${cycleIndex}-${step}.png`) })
        .catch(() => {});
    }
  };

  // 1. open one file tab from Files mode -> close it.
  try {
    await openFile(page, nav, FILE_A);
    await page.keyboard.press("Meta+w");
    await page.waitForFunction(() => document.querySelectorAll(".tab").length === 0, null, { timeout: 10_000 });
  } catch (error) {
    note("1-open-close", error);
    await closeAllTabs(page).catch(() => {});
  }

  // 2. open two files, split right, maximize, restore, close both.
  try {
    await openFile(page, nav, FILE_A);
    await openFile(page, nav, FILE_B);
    await page.keyboard.press("Meta+d");
    await page.waitForFunction(() => document.querySelectorAll(".pane.group").length === 2, null, { timeout: 10_000 });
    await page.keyboard.press("Meta+Alt+Enter");
    await waitForLocatorCount(page.locator(".pane.group:visible"), 1);
    await page.keyboard.press("Escape");
    await waitForLocatorCount(page.locator(".pane.group:visible"), 2);
  } catch (error) {
    note("2-split-maximize-restore", error);
  } finally {
    await closeAllTabs(page).catch((error) => note("2-close-both", error));
  }

  // 3. open the project wiki, pan via keyboard, zoom in/out, close.
  try {
    await ensureProjectMode(page, PROJECT, "wiki");
    await nav.getByRole("button", { name: `${PROJECT} neighbourhood` }).click();
    const knowledgeSurface = page.getByRole("region", { name: "Knowledge surface" });
    await knowledgeSurface.waitFor({ timeout: 10_000 });
    await page.waitForFunction(
      () => document.querySelector(".knowledge-surface")?.getAttribute("aria-busy") === "false",
      null,
      { timeout: 15_000 },
    );
    const graph = page.locator('svg[aria-label="Native wiki neighbourhood"]');
    if ((await graph.count()) > 0) {
      await graph.focus();
      const arrows = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
      for (let i = 0; i < GRAPH_PAN_REPEATS; i++) {
        await page.keyboard.press(arrows[i % arrows.length]);
      }
      const zoomIn = page.getByRole("button", { name: "Zoom in" });
      const zoomOut = page.getByRole("button", { name: "Zoom out" });
      if ((await zoomIn.count()) > 0) {
        await zoomIn.click();
        await zoomIn.click();
      }
      if ((await zoomOut.count()) > 0) {
        await zoomOut.click();
        await zoomOut.click();
      }
    } else {
      note("3-wiki-graph", "no [aria-label='Native wiki neighbourhood'] svg — graph did not render");
    }
  } catch (error) {
    note("3-wiki-open-pan-zoom", error);
  } finally {
    await page.keyboard.press("Meta+w");
    await ensureProjectMode(page, PROJECT, "files").catch((error) => note("3-restore-files-mode", error));
  }

  // 4. toggle right region open/closed, and full/escape.
  try {
    await page.keyboard.press("Meta+Shift+b");
    await page.waitForFunction(
      () => ["panel", "full"].includes(document.querySelector('[data-region="right"]')?.getAttribute("data-depth")),
      null,
      { timeout: 5_000 },
    );
    await page.keyboard.press("Meta+Alt+j");
    await page.waitForFunction(
      () => document.querySelector('[data-region="right"]')?.getAttribute("data-depth") === "full",
      null,
      { timeout: 5_000 },
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.querySelector('[data-region="right"]')?.getAttribute("data-depth") !== "full",
      null,
      { timeout: 5_000 },
    );
    await page.keyboard.press("Meta+Shift+b");
    await page.waitForFunction(
      () => document.querySelector('[data-region="right"]')?.getAttribute("data-depth") === "collapsed",
      null,
      { timeout: 5_000 },
    );
  } catch (error) {
    note("4-right-region-toggle", error);
  }

  // 5. switch between two open tabs 20x.
  try {
    await openFile(page, nav, FILE_A);
    await openFile(page, nav, FILE_B);
    for (let i = 0; i < TAB_SWITCH_REPEATS; i++) {
      await page.keyboard.press("Alt+Shift+ArrowLeft");
      await page.waitForTimeout(10);
    }
  } catch (error) {
    note("5-tab-switch", error);
  } finally {
    await closeAllTabs(page).catch((error) => note("5-close-both", error));
  }
}

async function sampleCdp(cdp, page) {
  await page.evaluate(() => {
    if (typeof window.gc === "function") window.gc();
  }).catch(() => {});
  const { metrics } = await cdp.send("Performance.getMetrics");
  const byName = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  const dom = await page.evaluate(() => ({
    query_all_count: document.querySelectorAll("*").length,
    iframe_count: document.querySelectorAll("iframe").length,
    img_count: document.querySelectorAll("img").length,
    svg_count: document.querySelectorAll("svg").length,
    surface_count: document.querySelectorAll("[data-surface-id]").length,
    tab_count: document.querySelectorAll(".tab").length,
  }));
  return { cdp: byName, dom };
}

function linearFitSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export default async function run(ctx) {
  const { page, baseUrl, bridgeUrl, check, shot, metric, artifactsDir, log } = ctx;
  const cycles = ctx.cycles ?? 20;
  const outPath = ctx.outPath ?? join(artifactsDir, "resources.json");
  const summaryPath = outPath.replace(/\.json$/, "-summary.md");
  const logLine = (message) => (log ? log(message) : console.log(`  ${message}`));

  let bridgeRequestsSinceReset = 0;
  const onRequest = (request) => {
    if (bridgeUrl && request.url().startsWith(bridgeUrl)) bridgeRequestsSinceReset++;
  };
  page.on("request", onRequest);

  await page.goto(baseUrl);
  const nav = page.getByRole("complementary", { name: "World navigator" });
  await nav.waitFor({ timeout: 20_000 });

  // Deterministic baseline: right region fully collapsed before cycle 1,
  // regardless of what state a previous session (or the live restyle) left
  // it in.
  const collapseRight = page.getByRole("button", { name: "Collapse right region" });
  if ((await collapseRight.count()) > 0) await collapseRight.click();

  await nav.locator(`[data-project-path="Work/${escapeAttr(PROJECT)}"]`).click();
  await ensureProjectExpanded(nav, PROJECT);
  await ensureProjectMode(page, PROJECT, "files");
  const projectFiles = nav.locator(`[data-navigation-path="Work/${escapeAttr(PROJECT)}"] .project-files`);
  await projectFiles.waitFor({ timeout: 10_000 });
  await ensureFolderExpanded(projectFiles, basename(dirname(FILE_B.path)));
  await nav.locator(`[data-file-path="Work/${escapeAttr(PROJECT)}/${escapeAttr(FILE_B.path)}"]`).waitFor({ timeout: 10_000 });

  const issues = [];
  const perCycle = [];
  let cdpSession = null;

  for (let cycle = 1; cycle <= cycles; cycle++) {
    const sampled = cycle > WARMUP_CYCLES;
    if (sampled && !cdpSession) {
      cdpSession = await page.context().newCDPSession(page);
      await cdpSession.send("Performance.enable");
      logLine(`warm-up complete (${WARMUP_CYCLES} cycles) — CDP session attached, sampling begins`);
    }
    bridgeRequestsSinceReset = 0;
    const t0 = Date.now();
    await runCycle(page, nav, issues, cycle, artifactsDir);
    const wallTimeMs = Date.now() - t0;
    logLine(`cycle ${cycle}/${cycles} ${sampled ? "(sampled)" : "(warm-up)"} — ${wallTimeMs}ms`);

    if (sampled) {
      const { cdp, dom } = await sampleCdp(cdpSession, page);
      perCycle.push({
        cycle,
        wall_time_ms: wallTimeMs,
        bridge_requests: bridgeRequestsSinceReset,
        heap_used_bytes: cdp.JSHeapUsedSize ?? null,
        heap_total_bytes: cdp.JSHeapTotalSize ?? null,
        nodes: cdp.Nodes ?? null,
        listeners: cdp.JSEventListeners ?? null,
        documents: cdp.Documents ?? null,
        frames: cdp.Frames ?? null,
        dom_query_all_count: dom.query_all_count,
        iframe_count: dom.iframe_count,
        img_count: dom.img_count,
        svg_count: dom.svg_count,
        retained_hint: {
          surface_count: dom.surface_count,
          tab_count: dom.tab_count,
          surfaces_minus_tabs: dom.surface_count - dom.tab_count,
          documents_beyond_expected: (cdp.Documents ?? 0) - (1 + dom.iframe_count),
        },
      });
    }
  }

  page.off("request", onRequest);

  const heapSeries = perCycle.map((c) => c.heap_used_bytes).filter((v) => typeof v === "number");
  const nodeSeries = perCycle.map((c) => c.nodes).filter((v) => typeof v === "number");
  const heapSlope = linearFitSlope(heapSeries);
  const nodeSlope = linearFitSlope(nodeSeries);
  const firstStable = perCycle[0] ?? null;
  const last = perCycle[perCycle.length - 1] ?? null;
  const heapThreshold = firstStable ? 0.01 * firstStable.heap_used_bytes : Infinity;
  const boundedHeap = firstStable ? heapSlope < heapThreshold : false;
  const boundedNodes = nodeSlope < 5;
  const verdict = firstStable && last
    ? boundedHeap && boundedNodes
      ? `bounded — heap grows ${round(heapSlope, 1)} B/cycle (< 1% of first-stable ${firstStable.heap_used_bytes} B) and DOM nodes grow ${round(nodeSlope, 2)}/cycle (< 5/cycle)`
      : `growth observed — heap grows ${round(heapSlope, 1)} B/cycle (threshold ${round(heapThreshold, 1)} B/cycle) and/or DOM nodes grow ${round(nodeSlope, 2)}/cycle (threshold 5/cycle); not bounded within the stated envelope`
    : "no sampled cycles completed — cannot render a verdict";

  const result = {
    schema: "oi.cradle.walk.resources/v1",
    label: "baseline-during-shell-rebuild",
    generated_at: new Date().toISOString(),
    environment: {
      base_url: baseUrl,
      bridge_url: bridgeUrl,
      project: PROJECT,
      viewport: "1280x820",
      node: process.version,
      platform: process.platform,
      chromium_flags: ["--js-flags=--expose-gc"],
      gc_exposed: await page.evaluate(() => typeof window.gc === "function").catch(() => false),
    },
    cycles,
    warmup_cycles: WARMUP_CYCLES,
    per_cycle: perCycle,
    step_issues: issues,
    summary: {
      first_stable: firstStable,
      last,
      growth_per_cycle: {
        heap_used_bytes_per_cycle: round(heapSlope, 2),
        nodes_per_cycle: round(nodeSlope, 3),
      },
      verdict,
    },
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  logLine(`wrote ${outPath}`);

  const md = [
    "# Resources walk — summary",
    "",
    `label: \`baseline-during-shell-rebuild\` · generated ${result.generated_at}`,
    "",
    `- base URL: ${baseUrl}`,
    `- bridge URL: ${bridgeUrl}`,
    `- cycles: ${cycles} (warm-up ${WARMUP_CYCLES}, sampled ${perCycle.length})`,
    `- window.gc exposed: ${result.environment.gc_exposed}`,
    `- step issues recorded: ${issues.length}`,
    "",
    "| cycle | wall ms | heap used (B) | heap total (B) | nodes | listeners | documents | frames | bridge reqs | surfaces-tabs |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...perCycle.map(
      (c) =>
        `| ${c.cycle} | ${c.wall_time_ms} | ${c.heap_used_bytes ?? ""} | ${c.heap_total_bytes ?? ""} | ${c.nodes ?? ""} | ${c.listeners ?? ""} | ${c.documents ?? ""} | ${c.frames ?? ""} | ${c.bridge_requests} | ${c.retained_hint.surfaces_minus_tabs} |`,
    ),
    "",
    "## first stable vs last",
    "",
    "| | first stable (cycle " + (firstStable?.cycle ?? "-") + ") | last (cycle " + (last?.cycle ?? "-") + ") |",
    "|---|---:|---:|",
    `| heap used (B) | ${firstStable?.heap_used_bytes ?? ""} | ${last?.heap_used_bytes ?? ""} |`,
    `| nodes | ${firstStable?.nodes ?? ""} | ${last?.nodes ?? ""} |`,
    `| listeners | ${firstStable?.listeners ?? ""} | ${last?.listeners ?? ""} |`,
    `| documents | ${firstStable?.documents ?? ""} | ${last?.documents ?? ""} |`,
    "",
    `growth per cycle: heap ${result.summary.growth_per_cycle.heap_used_bytes_per_cycle} B/cycle · nodes ${result.summary.growth_per_cycle.nodes_per_cycle}/cycle`,
    "",
    `**verdict:** ${verdict}`,
    "",
    issues.length
      ? `## step issues\n\n${issues.map((i) => `- cycle ${i.cycle} · ${i.step}: ${i.error}`).join("\n")}\n`
      : "## step issues\n\nnone recorded.\n",
  ].join("\n");
  writeFileSync(summaryPath, `${md}\n`);
  logLine(`wrote ${summaryPath}`);

  if (typeof metric === "function") {
    metric("heap_used_bytes_per_cycle", result.summary.growth_per_cycle.heap_used_bytes_per_cycle);
    metric("nodes_per_cycle", result.summary.growth_per_cycle.nodes_per_cycle);
    metric("sampled_cycles", perCycle.length);
    metric("step_issue_count", issues.length);
  }
  if (typeof check === "function") {
    check(issues.length === 0, "All five per-cycle steps completed on every cycle without a caught error", {
      issue_count: issues.length,
    });
    check(boundedHeap && boundedNodes, verdict, {
      heap_slope: heapSlope,
      node_slope: nodeSlope,
    });
  }
  if (typeof shot === "function") await shot("final");

  return result;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[key] = value;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.url ?? "http://localhost:1423";
  const bridgeUrl = args.bridge ?? "http://127.0.0.1:4179";
  const cycles = Number(args.cycles ?? 20);
  const outPath = resolve(process.cwd(), args.out ?? "walk/artifacts/resources.json");
  const artifactsDir = dirname(outPath);
  mkdirSync(artifactsDir, { recursive: true });

  console.log(`resources walk: ${cycles} cycles against ${baseUrl} (bridge ${bridgeUrl}) -> ${outPath}`);

  const browser = await chromium.launch({ args: ["--js-flags=--expose-gc"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await page.addInitScript((url) => {
    window.__OI_KERNEL_BRIDGE__ = url;
  }, bridgeUrl);

  const ctx = {
    scenario: "resources",
    page,
    baseUrl,
    bridgeUrl,
    artifactsDir,
    cycles,
    outPath,
    log: (message) => console.log(`  ${message}`),
    check(ok, label, data) {
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
      if (data !== undefined) console.log(`  ${JSON.stringify(data)}`);
      return !!ok;
    },
    metric(key, value) {
      console.log(`  metric ${key} = ${value}`);
    },
    async shot(label) {
      const file = join(artifactsDir, `resources-${label}.png`);
      await page.screenshot({ path: file });
      console.log(`  screenshot: ${file}`);
    },
  };

  let exitCode = 0;
  try {
    await run(ctx);
  } catch (error) {
    console.error(`RESOURCES WALK FAILED: ${error?.stack ?? error}`);
    await page.screenshot({ path: join(artifactsDir, "resources-failure.png") }).catch(() => {});
    exitCode = 1;
  } finally {
    await browser.close();
  }
  process.exit(exitCode);
}

const isMain = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (isMain) {
  main();
}
