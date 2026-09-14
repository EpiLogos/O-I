import {docText, waitForDoc} from '../editor-doc.mjs';
/**
 * FND-05 bootstrap walk (BOOT-00–15). Exercises the boot phases the
 * KernelProvider derives (`starting`/`ready`/`transport-unavailable`/
 * `ground-unrecognised`/`ground-inaccessible`), the window-scope overlay,
 * the chooser-first empty workspace, per-binding open-failure recovery
 * (BOOT-09) and the System composition's discovered-not-ready labelling +
 * truthful Gateway absence section (BOOT-06/12/15).
 *
 * Shaped like every other `walk/scenarios/*.mjs` module (`setup`/default
 * `run(ctx)`) so the lead can register it into `walk/run.mjs`'s SCENARIOS
 * map unchanged. It is ALSO directly runnable standalone — this file's own
 * `main()` (invoked when run as `node walk/scenarios/bootstrap.mjs`) drives
 * its own browser, vite preview and kernel bridge, so it needs no other
 * scenario file and touches no shared harness state:
 *
 *   node walk/scenarios/bootstrap.mjs --url http://127.0.0.1:4183 --bridge http://127.0.0.1:4197
 *
 * `--url`/`--bridge` point at a `vite preview` and `walk-bridge` this
 * caller already started on spare ports (never the shared :1421/:1423/
 * :4197 a dev session may be using). Omit either flag and this script
 * starts its own (a WALK=1 build + preview on 4183, a bridge on 4197).
 *
 * BOOT-09's real trigger is workspace RESTORATION against a kernel that
 * does not remember a binding the persisted layout still holds — not a
 * live click (every live open call already reads the owner eagerly before
 * a binding exists). This scenario opens a file once, then restarts the
 * kernel bridge (a fresh process — the real shape of a cold app relaunch)
 * before deleting the file and reloading, so the reconciliation effect's
 * own mount path is what fails. `ctx.bridge` (a small {restart(): Promise}
 * — provided by this file's own `main()`, and by nothing else today) gates
 * that one check; without it the rest of the walk still runs and the gap
 * is logged rather than failing the whole scenario.
 */
import { setup as groundSetup } from "./ground.mjs";
import { enterApp } from "../editor-doc.mjs";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRATCH_NAME = "bootstrap-scratch.txt";

export async function setup(args) {
  const p = await groundSetup(args);
  const scratchPath = join(p.projectRoot, SCRATCH_NAME);
  writeFileSync(scratchPath, "Ephemeral file for the BOOT-09 walk.\n");
  return { ...p, scratchPath };
}

async function shotTo(page, artifactsDir, name) {
  const dir = join(artifactsDir, "fnd");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `s5-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

export default async function run(ctx) {
  const { page, baseUrl, check, log, provision: p, artifactsDir } = ctx;

  // --- BOOT-00 / transport-unavailable: a separate context, no bridge ---
  {
    const bareContext = await page.context().browser().newContext();
    const bare = await bareContext.newPage();
    await bare.goto(baseUrl);
    await enterApp(bare);
    const start = bare.getByRole("button", { name: "Start writing", exact: true });
    await start.waitFor({ timeout: 15_000 });
    await start.click();
    const canvas = bare.locator(".draft-surface .cm-content");
    await canvas.waitFor({ timeout: 15_000 });
    await canvas.fill("Local writing works with no kernel transport.");
    await waitForDoc(bare, "Local writing works with no kernel transport.", ".draft-surface .cm-content", 15_000);
    check(
      (await docText(bare, ".draft-surface .cm-content")) === "Local writing works with no kernel transport.",
      "BOOT-00/transport-unavailable: an honest state still leaves usable writing, kept on this device",
    );
    await shotTo(bare, artifactsDir, "transport-unavailable");
    await bareContext.close();
  }

  // --- BOOT-02/03: ground-unrecognised shows the chooser first ---
  await page.goto(baseUrl);
  await enterApp(page);
  const chooser = page.getByRole("region", { name: "Central location" });
  await chooser.waitFor({ timeout: 15_000 });
  await page.getByText("No default Central selected", { exact: true }).first().waitFor({ timeout: 15_000 });
  check(true, "BOOT-02: an unrecognised ground shows the chooser first in the empty-workspace region, with the honest reason line");
  await shotTo(page, artifactsDir, "ground-unrecognised");

  // Local writing is still reachable beside the chooser (no fake gate).
  await page.getByRole("button", { name: /Start writing|Resume writing/ }).click();
  const unrecognised = page.locator(".draft-surface .cm-content");
  await unrecognised.waitFor({ timeout: 15_000 });
  await unrecognised.fill("Writing survives an unrecognised ground.");
  await waitForDoc(page, "Writing survives an unrecognised ground.", ".draft-surface .cm-content", 15_000);
  check(true, "BOOT-02: writing stays reachable while ground is unrecognised");
  await page.keyboard.press("Meta+w");

  // Recognise + bind the real root (same owner operations GroundChooser
  // always used — this walk changes nothing about that flow).
  const input = chooser.getByRole("textbox", { name: "Existing Central path" });
  await input.fill(p.root);
  await chooser.getByRole("button", { name: "Recognize", exact: true }).click();
  await chooser.getByText("recognized", { exact: true }).waitFor({ timeout: 15_000 });
  await chooser.getByRole("button", { name: "Use as default Central" }).click();
  await chooser.getByText(/Default Central saved/).waitFor({ timeout: 15_000 });
  check(true, "BOOT-03: an existing candidate can be recognised and bound as the default from the empty-workspace chooser");

  // --- open the scratch file once, ordinarily, before BOOT-09 ---
  const nav = page.getByRole("complementary", { name: "World navigator" });
  if (!(await nav.isVisible())) await page.keyboard.press("Meta+b");
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button", { name: "Editor: files", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-project-path="Work/Editor"]')?.getAttribute("aria-current") === "true",
    null,
    { timeout: 15_000 },
  );
  const fileEntry = nav.locator(`[data-file-path="Work/Editor/${SCRATCH_NAME}"]`);
  await fileEntry.waitFor({ timeout: 15_000 });
  await fileEntry.click();
  await page.waitForFunction(() => !!document.querySelector('.tab[data-active="true"]'), null, { timeout: 15_000 });
  check(true, "The scratch file opens ordinarily once, before it is ever deleted");

  // --- ready after reload (the bound default takes effect on relaunch) ---
  await page.reload();
  await page.waitForFunction(() => !document.getElementById("root")?.hasAttribute("inert"), null, { timeout: 15_000 });
  const stillShowingChooser = await page.getByRole("region", { name: "Central location" }).isVisible().catch(() => false);
  check(!stillShowingChooser, "BOOT-12/ready: the chooser is gone once the bound ground is recognised on relaunch");
  await shotTo(page, artifactsDir, "ready");

  // --- BOOT-09: per-binding open failure + Retry, via workspace restoration ---
  if (ctx.bridge?.restart) {
    if (!(await nav.isVisible())) await page.keyboard.press("Meta+b");
    if (!(await fileEntry.isVisible())) {
      await nav.locator('[data-project-path="Work/Editor"]').click();
      await nav.getByRole("button", { name: "Editor: files", exact: true }).click();
      await fileEntry.waitFor({ timeout: 15_000 });
    }
    await fileEntry.click();
    await page.waitForFunction(() => !!document.querySelector('.tab[data-active="true"]'), null, { timeout: 15_000 });
    // A fresh kernel process (the real shape of a cold relaunch) does not
    // remember this surface was ever opened; the persisted layout
    // (localStorage, untouched) still holds the binding — so reload drives
    // the reconciliation effect's own mount path, not a live click.
    rmSync(p.scratchPath, { force: true });
    await ctx.bridge.restart();
    await page.reload();
    const failure = page.getByRole("alert").filter({ hasText: "This binding could not be opened" });
    await failure.waitFor({ timeout: 15_000 });
    check(true, "BOOT-09: a binding the persisted layout still holds, but the fresh kernel could not reopen, shows a labelled failure instead of a silent tab");
    await shotTo(page, artifactsDir, "binding-failure");
    const retry = failure.getByRole("button", { name: "Retry" });
    check(await retry.isVisible(), "BOOT-09: the failed binding offers Retry");
    await retry.click();
    await page.waitForTimeout(500);
    check(await failure.isVisible().catch(() => false), "BOOT-09: Retry re-runs the same owner open (the file is still absent, so the labelled failure honestly remains)");
  } else {
    log("BOOT-09 skipped: this run provides no ctx.bridge.restart (only this file's own standalone main() does) — a real restoration failure needs a kernel that does not remember the binding.");
  }

  // --- System: the composition reading + the honest per-product gateway absence ---
  await page.getByRole("button", { name: "System", exact: true }).click();
  const system = page.getByRole("region", { name: "System composition" });
  // The reading's freshness renders as header facts; the census line exists
  // only once a reading is present, so it is the observed-freshness signal.
  await system.getByText(/\d+ disclosed · \d+ not disclosed/).waitFor({ timeout: 15_000 });
  for (const fact of ["Ground", "Suite", "Census", "Observed"]) {
    check(await system.getByText(fact, { exact: true }).count() > 0, `BOOT-06/12: the composition reading carries its ${fact} fact`);
  }
  const discoveredRow = system.getByText(/discovered, not verified ready/);
  check(await discoveredRow.count() > 0, "BOOT-06/12: an installed/registered product is labelled discovered, not verified ready — never asserted runtime-ready");
  // The gateway obligations moved into the per-product sections: the
  // Actuation section names them and marks each "not available yet" — no
  // invented ecology row, no probe, no auto start (BOOT-15).
  const actuation = system.locator("details.product-section", { hasText: "Actuation" });
  await actuation.getByText("Actuation", { exact: true }).waitFor({ timeout: 15_000 });
  await actuation.locator("summary").first().click();
  for (const obligation of ["Ecology read", "Attach", "Stream cursor / replay"]) {
    const row = actuation.locator("li").filter({ hasText: obligation });
    check(await row.getByText("not available yet").count() === 1, `BOOT-15: the gateway obligation "${obligation}" is disclosed honestly — not available yet, never invented`);
  }
  // The open project's SessionSpace topology is disclosed from the owner's
  // own agency reading — the row exists with the owner's count or the
  // owner's refusal, never an invented number.
  const aikit = system.locator("details.product-section", { hasText: "AIKit" });
  await aikit.locator("summary").first().click();
  await aikit.getByText(/SessionSpaces \(/).waitFor({ timeout: 15_000 });
  check(true, "BOOT-15: session topology is disclosed from the owner's agency reading (count or refusal verbatim), never invented");
  await shotTo(page, artifactsDir, "system-gateway");
}

// ---------------------------------------------------------------------------
// Standalone entrypoint: `node walk/scenarios/bootstrap.mjs [--url U] [--bridge B]`

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const cradleRoot = resolve(here, "..", "..");
  const artifactsDir = resolve(here, "..", "artifacts");
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const services = [];
  const spawnService = (label, command, cmdArgs, options = {}) => {
    const child = spawn(command, cmdArgs, { cwd: cradleRoot, detached: true, stdio: ["ignore", "pipe", "pipe"], ...options });
    let output = "";
    child.stdout.on("data", (c) => { output += c; console.log(`  [${label}] ${c}`.trimEnd()); });
    child.stderr.on("data", (c) => { output += c; console.log(`  [${label}] ${c}`.trimEnd()); });
    const record = { label, child, output: () => output };
    services.push(record);
    return record;
  };
  const stopService = (record) => {
    const i = services.indexOf(record);
    if (i >= 0) services.splice(i, 1);
    if (record.child.exitCode !== null) return;
    try { process.kill(-record.child.pid, "SIGTERM"); } catch { record.child.kill("SIGTERM"); }
  };
  const stopAll = () => { for (const r of [...services].reverse()) stopService(r); };
  process.once("exit", stopAll);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { stopAll(); process.exit(130); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitForHttp = async (url, what, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try { const r = await fetch(url); if (r.ok) return; } catch { /* not up yet */ }
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what} at ${url}`);
      await sleep(250);
    }
  };

  const externalUrl = flag("url");
  const externalBridge = flag("bridge");
  const previewPort = 4183;
  const bridgePort = 4197;
  const bridgeUrl = externalBridge ?? `http://127.0.0.1:${bridgePort}`;
  let bridgeService = null;

  const startBridge = async (env) => {
    bridgeService = spawnService(
      "walk-bridge",
      "cargo",
      ["run", "--quiet", "--manifest-path", join(cradleRoot, "kernel/Cargo.toml"), "--bin", "walk-bridge", "--", `127.0.0.1:${bridgePort}`],
      { env: { ...process.env, ...env } },
    );
    await waitForHttp(`${bridgeUrl}/state`, "the walk bridge", 180_000);
    console.log(`  walk bridge up: ${bridgeUrl} (fresh kernel, seq from 1)`);
  };

  let baseUrl = externalUrl;
  if (!baseUrl) {
    console.log("building the walk bundle (WALK=1 npm run build)…");
    await new Promise((res, rej) => {
      const build = spawnService("build", "npm", ["run", "build"], { env: { ...process.env, WALK: "1" } });
      build.child.on("exit", (code) => (code === 0 ? res() : rej(new Error(`build failed (${code})`))));
    });
    spawnService("preview", "npx", ["vite", "preview", "--port", String(previewPort), "--strictPort"]);
    baseUrl = `http://localhost:${previewPort}`;
    await waitForHttp(baseUrl, "vite preview", 60_000);
  }

  const provision = await setup({ cradleRoot });
  let bridge = null;
  if (!externalBridge) {
    await startBridge(provision.env);
    bridge = {
      async restart() {
        if (bridgeService) { stopService(bridgeService); await sleep(500); }
        await startBridge(provision.env);
      },
    };
  } else {
    console.log(`  using the caller's own bridge at ${bridgeUrl} — BOOT-09's restart sub-check needs this file's own bridge, so it will be skipped.`);
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await page.addInitScript((url) => { window.__OI_KERNEL_BRIDGE__ = url; }, bridgeUrl);

  const receipt = { schema: "oi.cradle.walk.scenario/v1", scenario: "bootstrap", generated_at: new Date().toISOString(), passed: true, error: null, checks: [] };
  const ctx = {
    scenario: "bootstrap", page, baseUrl, bridgeUrl, artifactsDir, provision,
    bridge,
    log: (m) => console.log(`  ${m}`),
    check(ok, label) {
      receipt.checks.push({ ok: !!ok, label });
      if (!ok) receipt.passed = false;
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
      return !!ok;
    },
  };

  try {
    await run(ctx);
  } catch (error) {
    receipt.passed = false;
    receipt.error = String(error?.stack ?? error);
    console.error(`  SCENARIO ERROR: ${receipt.error}`);
    try { await shotTo(page, artifactsDir, "failure"); } catch { /* best effort */ }
  } finally {
    await browser.close();
    provision.cleanup?.();
    stopAll();
  }

  const file = join(artifactsDir, "bootstrap.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`  receipt: walk/artifacts/bootstrap.json — ${receipt.checks.filter((c) => c.ok).length}/${receipt.checks.length} checks, ${receipt.passed ? "PASS" : "FAIL"}`);
  if (!existsSync(file)) throw new Error("receipt did not write");
  process.exit(receipt.passed ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
