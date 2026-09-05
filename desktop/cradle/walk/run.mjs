#!/usr/bin/env node
/**
 * The walk runner (U0.6, map §3 D10 + §5 U0.6) — drives the running app
 * end-to-end and emits one machine-readable receipt per scenario into
 * walk/artifacts/ (05-EXECUTION §3: walks are the acceptance; the receipt
 * is the walk as data).
 *
 * What it boots, as needed:
 *   - the walk bundle: `WALK=1 npm run build` (the production pipeline with
 *     the dev/walk channel baked in — SKIP_BUILD=1 reuses dist/);
 *   - `vite preview` serving that bundle (WALK_URL=<url> reuses a server);
 *   - the dev-only walk bridge (cargo, the same KernelOp seam the Tauri
 *     host fronts) for scenarios that exercise the kernel — a fresh bridge
 *     per scenario so each event log starts at seq 1.
 *
 * Usage:
 *   node walk/run.mjs <scenario|all> [more scenarios…]
 *   npm run walk -- all
 *
 * Scenarios: rest (u0.3) · surfaces (u0.3b) · kernel-cas (u0.4) · all
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, "..");
const artifactsDir = join(here, "artifacts");
const PREVIEW_PORT = 4173;
const BRIDGE_PORT = 4179;
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;

const SCENARIOS = {
  rest: { module: "scenarios/rest.mjs", kernel: false, aliases: ["u0.3"] },
  surfaces: { module: "scenarios/surfaces.mjs", kernel: true, aliases: ["u0.3b"] },
  "kernel-cas": { module: "scenarios/kernel-cas.mjs", kernel: true, aliases: ["u0.4"] },
  navigator: { module: "scenarios/navigator.mjs", kernel: true, aliases: ["u1.1"] },
  native: { module: "scenarios/native.mjs", kernel: false, aliases: ["package"] },
};

// ---------------------------------------------------------------------------
// process plumbing

const services = [];

/** Spawn a service in its own process group so teardown reaches its
 * children (vite under npm, the kernel binary under cargo). */
function spawnService(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: cradleRoot,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  let output = "";
  const record = {
    label,
    child,
    output: () => output,
  };
  const recordOutput = (chunk) => {
    output += chunk;
    for (const line of String(chunk).split("\n").filter(Boolean)) {
      console.log(`  [${label}] ${line}`);
    }
  };
  child.stdout.on("data", recordOutput);
  child.stderr.on("data", recordOutput);
  services.push(record);
  return record;
}

function stopService(record) {
  const index = services.indexOf(record);
  if (index >= 0) services.splice(index, 1);
  if (record.child.exitCode !== null) return;
  try {
    process.kill(-record.child.pid, "SIGTERM");
  } catch {
    record.child.kill("SIGTERM");
  }
  console.log(`  stopped ${record.label}`);
}

function stopServices() {
  for (const record of [...services].reverse()) stopService(record);
}

process.once("exit", stopServices);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopServices();
    process.exit(130);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => Date.now();

async function waitForHttp(url, what, timeoutMs) {
  const deadline = now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    if (now() > deadline) {
      const logs = services.map((s) => `--- ${s.label} ---\n${s.output()}`).join("\n");
      throw new Error(`timed out after ${timeoutMs} ms waiting for ${what} at ${url}\n${logs}`);
    }
    await sleep(250);
  }
}

/** Run a build/service command to completion, failing loudly. */
async function runToCompletion(label, command, args, env = {}) {
  console.log(`${label}`);
  const child = spawnService(label, command, args, {
    env: { ...process.env, ...env },
  });
  const code = await new Promise((resolve) => child.child.on("exit", resolve));
  if (code !== 0) {
    throw new Error(`${label} failed with exit code ${code}:\n${child.output()}`);
  }
}

// ---------------------------------------------------------------------------
// the harness each scenario drives

function makeHarness({ scenario, page, baseUrl, bridgeUrl, kernelScenario }) {
  const startedAt = now();
  const receipt = {
    schema: "oi.cradle.walk.scenario/v1",
    scenario,
    generated_at: new Date().toISOString(),
    environment: {
      base_url: baseUrl,
      bridge_url: kernelScenario ? bridgeUrl : null,
      viewport: "1280x820",
      bundle: "walk (WALK=1) served by vite preview",
      node: process.version,
      platform: process.platform,
    },
    passed: true,
    error: null,
    duration_ms: 0,
    checks: [],
    ops: [],
    metrics: {},
    screenshots: [],
  };

  const ctx = {
    scenario,
    page,
    baseUrl,
    bridgeUrl: kernelScenario ? bridgeUrl : null,
    artifactsDir,
    log: (message) => console.log(`  ${message}`),

    check(ok, label, data) {
      const entry = { ok: !!ok, label };
      if (data !== undefined) entry.data = data;
      receipt.checks.push(entry);
      if (!ok) receipt.passed = false;
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
      return !!ok;
    },

    metric(key, value) {
      if (typeof value === "number" && Number.isFinite(value)) {
        receipt.metrics[key] = Math.round(value * 10) / 10;
      }
    },

    /** A harness-side capture op: screenshot into walk/artifacts/. The
     * runner owns the browser, so the PNG is taken here and recorded as a
     * typed receipt beside the channel's own ops. */
    async shot(label) {
      const file = `${scenario}-${label}.png`;
      const t0 = now();
      await page.screenshot({ path: join(artifactsDir, file) });
      receipt.screenshots.push(file);
      receipt.ops.push({
        ok: true,
        op: "capture.screenshot",
        duration_ms: now() - t0,
        data: { file },
      });
      ctx.log(`screenshot: artifacts/${file}`);
    },

    /** Call one typed op on the in-page `__cradle.walk` channel; the
     * receipt it returns is recorded verbatim as data. */
    async channel(path, args = [], options = {}) {
      const walkReceipt = await page.evaluate(
        async ([path, args]) => {
          // The channel mounts through a build-gated dynamic import inside
          // the provider's effects — wait for that mount instead of failing
          // a scenario on the load race (10 s ceiling, then the honest error).
          const deadline = Date.now() + 10_000;
          let channel = globalThis.__cradle?.walk;
          while (!channel && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            channel = globalThis.__cradle?.walk;
          }
          const fn = path
            .split(".")
            .reduce((obj, key) => (obj === undefined || obj === null ? obj : obj[key]), channel);
          if (typeof fn !== "function") {
            return {
              ok: false,
              op: path,
              duration_ms: 0,
              error: `__cradle.walk.${path} is not mounted — run against a dev/walk bundle`,
            };
          }
          return fn(...args);
        },
        [path, args],
      );
      receipt.ops.push(walkReceipt);
      if (!walkReceipt.ok && !options.soft) {
        throw new Error(`channel op ${path} failed: ${walkReceipt.error}`);
      }
      return walkReceipt;
    },

    /** Time one harness-driven sequence (keyboard/pointer gestures, DOM
     * waits) as a typed op receipt — metrics are data, never prose.
     * Returns {data, duration_ms}. */
    async op(name, run) {
      const t0 = now();
      try {
        const data = await run();
        const duration_ms = now() - t0;
        const entry = { ok: true, op: name, duration_ms };
        if (data !== undefined) entry.data = data;
        receipt.ops.push(entry);
        return { data, duration_ms };
      } catch (error) {
        receipt.ops.push({ ok: false, op: name, duration_ms: now() - t0, error: String(error) });
        throw error;
      }
    },

    async eventsAfter(seq) {
      const walkReceipt = await ctx.channel("read.events", [seq]);
      return walkReceipt.data.receipts;
    },

    async waitForEvents(fromSeq, predicate, what, timeoutMs = 15_000) {
      const deadline = now() + timeoutMs;
      for (;;) {
        const events = await ctx.eventsAfter(fromSeq);
        if (predicate(events)) return events;
        if (now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await sleep(100);
      }
    },

    finish() {
      receipt.duration_ms = now() - startedAt;
      return receipt;
    },
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// scenario lifecycle

async function runScenario(name, { baseUrl }) {
  const spec = SCENARIOS[name];
  console.log(`\n=== scenario: ${name} ===`);
  mkdirSync(artifactsDir, { recursive: true });

  let bridgeUrl = null;
  let bridgeService = null;
  if (spec.kernel) {
    bridgeService = spawnService(
      "walk-bridge",
      "cargo",
      [
        "run",
        "--quiet",
        "--manifest-path",
        join(cradleRoot, "kernel/Cargo.toml"),
        "--bin",
        "walk-bridge",
        "--",
        `127.0.0.1:${BRIDGE_PORT}`,
      ],
    );
    await waitForHttp(`${BRIDGE_URL}/state`, "the walk bridge", 180_000);
    console.log(`  walk bridge up: ${BRIDGE_URL} (fresh kernel, seq from 1)`);
    bridgeUrl = BRIDGE_URL;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  if (bridgeUrl) {
    await page.addInitScript((url) => {
      window.__OI_KERNEL_BRIDGE__ = url;
    }, bridgeUrl);
  }

  const ctx = makeHarness({ scenario: name, page, baseUrl, bridgeUrl, kernelScenario: spec.kernel });
  const scenario = await import(`${fileURLToPath(new URL(spec.module, import.meta.url))}`);
  let receipt;
  try {
    await scenario.default(ctx);
    receipt = ctx.finish();
  } catch (error) {
    receipt = ctx.finish();
    receipt.passed = false;
    receipt.error = String(error?.stack ?? error);
    console.error(`  SCENARIO ERROR: ${receipt.error}`);
  } finally {
    await browser.close();
  }

  // A fresh bridge per kernel scenario: stop just the bridge (the preview
  // keeps serving) so the next scenario's log starts at seq 1.
  if (bridgeService) {
    stopService(bridgeService);
    await sleep(500);
  }

  const file = join(artifactsDir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    `  receipt: artifacts/${name}.json — ${receipt.checks.filter((c) => c.ok).length}/` +
      `${receipt.checks.length} checks, ${receipt.passed ? "PASS" : "FAIL"}`,
  );
  return receipt;
}

// ---------------------------------------------------------------------------
// entrypoint

function resolveNames(args) {
  if (args.length === 0 || args.includes("all")) {
    return Object.keys(SCENARIOS);
  }
  const names = [];
  for (const arg of args) {
    const canonical =
      SCENARIOS[arg] ? arg : Object.keys(SCENARIOS).find((n) => SCENARIOS[n].aliases.includes(arg));
    if (!canonical) {
      console.error(`unknown scenario \`${arg}\`; known: ${Object.keys(SCENARIOS).join(", ")}, all`);
      process.exit(2);
    }
    names.push(canonical);
  }
  return names;
}

const names = resolveNames(process.argv.slice(2));
const externalUrl = process.env.WALK_URL;
const needsBundle = !externalUrl && process.env.SKIP_BUILD !== "1";
const needsPreview = !externalUrl;
const baseUrl = externalUrl ?? `http://localhost:${PREVIEW_PORT}`;

try {
  mkdirSync(artifactsDir, { recursive: true });
  if (needsBundle) {
    await runToCompletion(
      "building the walk bundle (WALK=1 npm run build)",
      "npm",
      ["run", "build"],
      { WALK: "1" },
    );
  }
  if (needsPreview) {
    spawnService("preview", "npm", ["run", "preview"]);
    await waitForHttp(baseUrl, "the preview server", 60_000);
  }
  console.log(`serving the cradle at ${baseUrl}${externalUrl ? " (external)" : ""}`);

  const results = [];
  for (const name of names) {
    results.push(await runScenario(name, { baseUrl }));
  }

  console.log("\n=== walk summary ===");
  let failed = 0;
  for (const receipt of results) {
    const metrics = Object.entries(receipt.metrics)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    console.log(
      `${receipt.passed ? "PASS" : "FAIL"}  ${receipt.scenario} — ` +
        `${receipt.checks.filter((c) => c.ok).length}/${receipt.checks.length} checks` +
        (metrics ? ` · ${metrics}` : ""),
    );
    if (!receipt.passed) failed++;
  }
  process.exit(failed ? 1 : 0);
} catch (error) {
  console.error(`\nRUN FAILED: ${error?.stack ?? error}`);
  process.exit(1);
}
