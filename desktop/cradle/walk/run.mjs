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

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { normalizeRegistry, resolveScenarioNames, classifyFailure, DisposerStack, dirtyTreeDigest, buildInputIdentity } from "./run-support.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, "..");
const artifactsDir = join(here, "artifacts");
// A borrowed node_modules can redirect a workspace package into another
// checkout. Prove the engine dependency belongs to this exact worktree before
// building or recording a native/browser acceptance receipt.
const repositoryRoot = resolve(cradleRoot, "../..");
const expectedEngineProvenance = realpathSync(join(repositoryRoot, "packages/oi-design-system/expressions-engine/PROVENANCE.json"));
const loadedEngineProvenance = realpathSync(createRequire(import.meta.url).resolve("@epilogos/oi-design-system/expressions-engine/PROVENANCE.json"));
if (loadedEngineProvenance !== expectedEngineProvenance) {
  throw new Error(`The walk's engine dependency resolves outside its checkout: ${loadedEngineProvenance}. Run npm ci inside this checkout's desktop/cradle; do not borrow another checkout's node_modules.`);
}
const engineProvenance = JSON.parse(readFileSync(loadedEngineProvenance, "utf8"));
// The dirty-tree digest reads the whole repo's diff; a tree carrying parallel
// receipt restamps exceeds execFileSync's 1 MB default buffer, so widen it —
// the digest hashes whatever the diff is, it does not parse it.
const runGit = (args) => execFileSync("git", args, {cwd:repositoryRoot, encoding:"utf8", maxBuffer:64*1024*1024});
const sourceContext = {
  repository_root: repositoryRoot,
  repository_head: runGit(["rev-parse", "HEAD"]).trim(),
  tracked_changes: runGit(["diff", "--name-only", "HEAD"]).trim().split("\n").filter(Boolean),
  // A digest of the dirty tree (status + diff, hashed — never the contents),
  // so a receipt binds to the exact uncommitted state that produced it and a
  // reused build can be told from current source.
  dirty_digest: dirtyTreeDigest(runGit),
  engine_provenance_path: loadedEngineProvenance,
  engine_source: engineProvenance.source,
  engine_revision: engineProvenance.sha,
};
// How the served bytes were obtained (fresh build, reused dist or external
// URL) with a bundle fingerprint — filled once the preview is up, so every
// receipt can bind its result to the exact build it exercised.
let buildInput = null;

const PREVIEW_PORT = Number(process.env.WALK_PREVIEW_PORT ?? 4173);
if (!Number.isInteger(PREVIEW_PORT) || PREVIEW_PORT < 1024 || PREVIEW_PORT > 65535) throw new Error("WALK_PREVIEW_PORT must be a port from 1024 to 65535");
const BRIDGE_PORT = Number(process.env.WALK_BRIDGE_PORT ?? 4179);
if (!Number.isInteger(BRIDGE_PORT) || BRIDGE_PORT < 1024 || BRIDGE_PORT > 65535) throw new Error("WALK_BRIDGE_PORT must be a port from 1024 to 65535");
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;

const SCENARIOS = {
  "expression-controls": {module:"scenarios/expression-controls.mjs",kernel:true,aliases:[]},
  "expression-page": {module:"scenarios/expression-page.mjs",kernel:true,aliases:["ex5"]},
  "expression-world-join": {module:"scenarios/expression-world-join.mjs",kernel:true,aliases:["join"]},
  "corpus-return-of-zero": {module:"scenarios/corpus-return-of-zero.mjs",kernel:true,aliases:["roz","corpus"]},
  refinement:{module:"scenarios/refinement.mjs",kernel:true,aliases:[]},
  "shell-recovery": {module:"scenarios/shell-recovery.mjs",kernel:true,aliases:[]},
  ground:{module:"scenarios/ground.mjs",kernel:true,aliases:[]},
  recovery:{module:"scenarios/recovery.mjs",kernel:false,aliases:[]},
  rest: { module: "scenarios/rest.mjs", kernel: false, aliases: ["u0.3"] },
  welcome: { module: "scenarios/welcome.mjs", kernel: true, aliases: [] },
  instrument: { module: "scenarios/instrument.mjs", kernel: true, aliases: ["k9"] },
  "instrument-host": { module: "scenarios/instrument-host.mjs", kernel: true, aliases: ["k9-host"] },
  "instrument-native-host": { module: "scenarios/instrument-native-host.mjs", kernel: true, aliases: ["k9-native"] },
  "sf5-protected-nara": { module: "scenarios/sf5-protected-nara.mjs", kernel: true, aliases: ["sf5"] },
  "sf6-joined-two-worlds": { module: "scenarios/sf6-joined-two-worlds.mjs", kernel: true, aliases: ["sf6"] },
  "nara-speech": { module: "scenarios/nara-speech.mjs", kernel: true, aliases: ["nara"] },
  "nara-stage-focus": { module: "scenarios/nara-stage-focus.mjs", kernel: true, aliases: ["nara-stage"] },
  visuals: { module: "scenarios/visuals.mjs", kernel: true, aliases: [] },
  surfaces: { module: "scenarios/surfaces.mjs", kernel: true, aliases: ["u0.3b"] },
  modes: { module: "scenarios/modes.mjs", kernel: true, aliases: [] },
  "mode-gallery": { module: "scenarios/mode-gallery.mjs", kernel: true, aliases: [] },
  "agent-panel": { module: "scenarios/agent-panel.mjs", kernel: true, aliases: [] },
  "mode-workspaces": { module: "scenarios/mode-workspaces.mjs", kernel: true, aliases: [] },
  "kernel-cas": { module: "scenarios/kernel-cas.mjs", kernel: true, aliases: ["u0.4"] },
  system: {module:"scenarios/system.mjs",kernel:true,aliases:[]},
  "system-settings": {module:"scenarios/system-settings.mjs",kernel:true,aliases:[]},
  configuration: {module:"scenarios/configuration.mjs",kernel:true,aliases:["c6"]},
  permission: {module:"scenarios/permission.mjs",kernel:true,aliases:[]},
  encounter: {module:"scenarios/encounter.mjs",kernel:true,aliases:[]},
  "agent-dictation": {module:"scenarios/agent-dictation.mjs",kernel:true,aliases:["dictation"]},
  "context-draft": {module:"scenarios/context-draft.mjs",kernel:true,aliases:[]},
  "canvas-context": {module:"scenarios/canvas-context.mjs",kernel:true,aliases:["canvas"]},
  "remember": {module:"scenarios/remember.mjs",kernel:true,aliases:["u3.3"]},
  "contemplate": {module:"scenarios/contemplate.mjs",kernel:true,aliases:["w14"]},
  "select-send": {module:"scenarios/select-send.mjs",kernel:true,aliases:["6b"]},
  "send-group-reconnect": {module:"scenarios/send-group-reconnect.mjs",kernel:true,aliases:["6b2"]},
  "receive-include": {module:"scenarios/receive-include.mjs",kernel:true,aliases:["6e"]},
  "receive-recover": {module:"scenarios/receive-recover.mjs",kernel:true,aliases:["6e2"]},
  "first-vertical": {module:"scenarios/first-vertical.mjs",kernel:true,aliases:["vertical"]},
  "shared-field-return": {module:"scenarios/shared-field-return.mjs",kernel:true,aliases:["7"]},
  "contribution-return-sf4": {module:"scenarios/contribution-return-sf4.mjs",kernel:true,aliases:["sf4"]},
  "shared-field-hosted": {module:"scenarios/shared-field-hosted.mjs",kernel:true,aliases:["lane-c5","u-sf1"]},
  "explore-sf1": {module:"scenarios/explore-sf1.mjs",kernel:true,aliases:["sf1","explore"]},
  "explore-sf2": {module:"scenarios/explore-sf2.mjs",kernel:true,aliases:["sf2","knowledge-encounter"]},
  "workspace-continuity": {module:"scenarios/workspace-continuity.mjs",kernel:true,aliases:["ws-continuity"]},
  "html-continuity": {module:"scenarios/html-continuity.mjs",kernel:true,aliases:["html-cont"]},
  "mode-engine-state": {module:"scenarios/mode-engine-state.mjs",kernel:true,aliases:["mode-engine"]},
  "a2a-exchange": {module:"scenarios/a2a-exchange.mjs",kernel:true,aliases:["7b"]},
  "agency-a2a": {module:"scenarios/agency-a2a.mjs",kernel:true,aliases:["7c"]},
  "flow-canvas": {module:"scenarios/flow-canvas.mjs",kernel:true,aliases:["u4.1"]},
  "leave-reenter": {module:"scenarios/leave-reenter.mjs",kernel:true,aliases:["6f"]},
  "day-edit": {module:"scenarios/day-edit.mjs",kernel:true,aliases:["6f2"]},
  "now-relations": {module:"scenarios/now-relations.mjs",kernel:true,aliases:["now"]},
  "task-basis": {module:"scenarios/task-basis.mjs",kernel:true,aliases:["6b3"]},
  "factory-development": {module:"scenarios/factory-development.mjs",kernel:true,aliases:["6d"]},
  "agency-planes": {module:"scenarios/agency-planes.mjs",kernel:true,aliases:["6c"]},
  "file-edit": {module:"scenarios/file-edit.mjs",kernel:true,aliases:[]},
  files: { module: "scenarios/files.mjs", kernel: true, aliases: [] },
  "rendering-quality": {module:"scenarios/rendering-quality.mjs",kernel:true,aliases:[]},
  "page-context": { module: "scenarios/page-context.mjs", kernel: true },
  material: { module: "scenarios/material.mjs", kernel: true, aliases: ["fnd-04"] },
  bootstrap: { module: "scenarios/bootstrap.mjs", kernel: true, aliases: ["fnd-05"] },
  resources: { module: "scenarios/resources.mjs", kernel: true, aliases: ["fnd-06"] },
  navigator: { module: "scenarios/navigator.mjs", kernel: true, aliases: ["u1.1"] },
  editor: { module: "scenarios/editor.mjs", kernel: true, aliases: ["u1.2"] },
  knowledge: { module: "scenarios/knowledge.mjs", kernel: true, aliases: ["u3.1", "u3.4"] },
  "knowledge-expression": { module: "scenarios/knowledge-expression.mjs", kernel: true, aliases: ["ex3"] },
  history: { module: "scenarios/history.mjs", kernel: true, aliases: ["u1.3"] },
  spatial: { module: "scenarios/spatial.mjs", kernel: true, aliases: ["shell"] },
  companions: { module: "scenarios/companions.mjs", kernel: false, aliases: ["round2"] },
  study: { module: "scenarios/study.mjs", kernel: false, aliases: ["ui-study"] },
  native: { module: "scenarios/native.mjs", kernel: false, aliases: ["package"] },
  "document-entry": { module: "scenarios/document-entry.mjs", kernel: true, aliases: ["6a"] },
  "background-completion": {module:"scenarios/background-completion.mjs",kernel:true,aliases:[]},
};

// Which design/spec row each scenario's receipt serves, and an optional grade
// override (DESKTOP-LANGUAGE.md ruling 8: every receipt carries spec_ref +
// grade; A = live/installed/native, B = real-kernel walk-bridge, C =
// contract/static, D = controlled/fixture). Without an override the grade is
// B for kernel:true scenarios and C for kernel:false. Keep the spec table in
// sync with scripts/receipt-lint.mjs SCENARIO_SPEC; anything unnamed serves
// the constitutional basis: walks are the acceptance (05-EXECUTION §3).
const SCENARIO_SPEC = {
  "system-settings": { spec_ref: "docs/cradle/06-SYSTEM-SETTINGS.md §7" },
  configuration: { spec_ref: "docs/cradle/09-CONFIGURATION-PLANE.md" },
  "factory-development": { spec_ref: "docs/experience/FACTORY-AGENCY.md §4/§5/§8/§12" },
  "background-completion": { spec_ref: "docs/experience/FACTORY-AGENCY.md §1 + handoff §4" },
};
const DEFAULT_SPEC_REF = "docs/cradle/05-EXECUTION.md §3";

// Declared source relations (walk/scenario-bindings.json): which #65
// obligations/stories a scenario serves, which required branches and
// source-defined negative classes its checks exercise. The compiler
// (scripts/experience_map.py --coverage) validates these against the
// obligation field and joins receipts as latest performed evidence; the
// receipt carries the declaration so executed evidence keeps its relation.
let DECLARED_BINDINGS = {};
try {
  DECLARED_BINDINGS = JSON.parse(readFileSync(join(here, "scenario-bindings.json"), "utf8")).tests ?? {};
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const declaredBinding = (name) => {
  const binding = DECLARED_BINDINGS[name];
  return binding ? {
    serves: binding.serves,
    branches: binding.branches ?? {},
    negatives: binding.negatives ?? [],
    claims_grade: binding.claims_grade ?? "D",
  } : null;
};

function receiptStanding(name, kernelScenario) {
  const declared = SCENARIO_SPEC[name];
  return {
    spec_ref: declared?.spec_ref ?? DEFAULT_SPEC_REF,
    grade: declared?.grade ?? (kernelScenario ? "B" : "C"),
    binding: declaredBinding(name),
  };
}

// Every entry must name a module and carry an alias list before any name or
// alias is resolved — a malformed runner is rejected here, not surfaced later
// as a misleading scenario failure.
normalizeRegistry(SCENARIOS);

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
    ...receiptStanding(scenario, kernelScenario),
    generated_at: new Date().toISOString(),
    environment: {
      base_url: baseUrl,
      bridge_url: kernelScenario ? bridgeUrl : null,
      viewport: "1280x820",
      browser_engine: process.env.WALK_ENGINE === "webkit" ? "webkit" : "chromium",
      bundle: "walk (WALK=1) served by vite preview",
      build_input: buildInput,
      node: process.version,
      platform: process.platform,
      source: sourceContext,
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

/** A durable receipt for a scenario that failed before its body could produce
 * one — setup-unavailable, harness or application. It records the stage, the
 * primary error and any cleanup errors distinctly, and never reads as a pass. */
function failedReceipt({ name, kernelScenario, baseUrl, startedAt, failure, cleanup }) {
  return {
    schema: "oi.cradle.walk.scenario/v1",
    scenario: name,
    ...receiptStanding(name, kernelScenario),
    generated_at: new Date().toISOString(),
    environment: {
      base_url: baseUrl,
      bridge_url: kernelScenario ? BRIDGE_URL : null,
      viewport: "1280x820",
      browser_engine: process.env.WALK_ENGINE === "webkit" ? "webkit" : "chromium",
      bundle: "walk (WALK=1) served by vite preview",
      build_input: buildInput,
      node: process.version,
      platform: process.platform,
      source: sourceContext,
    },
    passed: false,
    error: failure?.error ?? "the scenario failed before any receipt was produced",
    failure_stage: classifyFailure(failure?.stage),
    cleanup_errors: cleanup.errors,
    duration_ms: now() - startedAt,
    checks: [],
    ops: [],
    metrics: {},
    screenshots: [],
  };
}

async function runScenario(name, { baseUrl }) {
  const spec = SCENARIOS[name];
  console.log(`\n=== scenario: ${name} ===`);
  mkdirSync(artifactsDir, { recursive: true });

  // The whole lifecycle — setup, bridge, browser, page and body — runs inside
  // one boundary. Disposers are registered as resources are acquired and torn
  // down in reverse on the way out, so an early failure still produces a
  // durable receipt and never strands a browser, bridge or setup resource.
  const disposers = new DisposerStack();
  const startedAt = now();
  let stage = "setup";
  let receipt = null;
  let failure = null;

  try {
    const scenario = await import(`${fileURLToPath(new URL(spec.module, import.meta.url))}`);
    const provision = await scenario.setup?.({ cradleRoot });
    // Setup's cleanup is registered the moment it exists, so a later bridge or
    // browser failure still unwinds it (setup owns any resource it created
    // before throwing).
    if (provision?.cleanup) disposers.push("provision.cleanup", () => provision.cleanup());

    let bridgeUrl = null;
    if (spec.kernel) {
      stage = "bridge";
      const bridgeService = spawnService(
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
        { env: { ...process.env, ...provision?.env } },
      );
      // A fresh bridge per kernel scenario: stop just the bridge (the preview
      // keeps serving) so the next scenario's log starts at seq 1.
      disposers.push("walk-bridge", () => stopService(bridgeService));
      await waitForHttp(`${BRIDGE_URL}/state`, "the walk bridge", 180_000);
      console.log(`  walk bridge up: ${BRIDGE_URL} (fresh kernel, seq from 1)`);
      bridgeUrl = BRIDGE_URL;
    }

    stage = "browser";
    // WALK_ENGINE selects the browser engine (chromium default; webkit for
    // conditions whose receiving semantics materially differ across engines).
    // The engine is recorded in every receipt's environment.
    const engineName = process.env.WALK_ENGINE === "webkit" ? "webkit" : "chromium";
    const browser = await (engineName === "webkit" ? webkit : chromium).launch(
      engineName === "chromium" && process.env.OI_CHROMIUM ? {executablePath:process.env.OI_CHROMIUM} : {});
    disposers.push("browser", () => browser.close());

    stage = "page";
    // An explicit context: leave/re-enter scenarios open a second page in the
    // SAME context (shared storage = the restored frame), which the implicit
    // browser.newPage() context refuses.
    const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    const page = await context.newPage();
    if (bridgeUrl) {
      await page.addInitScript((url) => {
        window.__OI_KERNEL_BRIDGE__ = url;
      }, bridgeUrl);
    }
    // Walks exercise the continuing app, so the welcome frontstate stands
    // down for them — except when a scenario explicitly asks for it via
    // ?frontstate (the welcome scenario runs the real first-open path).
    await page.addInitScript(() => {
      if (!new URLSearchParams(location.search).has("frontstate")) {
        // Opaque-origin frames (the sandboxed material iframes) refuse storage
        // access entirely — the touch must not throw there; only the top
        // document's stand-down matters.
        try {
          sessionStorage.setItem("oi-cradle.welcome.v1", "walk-continuing-session");
        } catch { /* opaque frame: no storage authority, no stand-down needed */ }
      }
    });

    stage = "scenario";
    const ctx = makeHarness({ scenario: name, page, baseUrl, bridgeUrl, kernelScenario: spec.kernel });
    ctx.provision = provision;
    try {
      await scenario.default(ctx);
      receipt = ctx.finish();
    } catch (error) {
      receipt = ctx.finish();
      receipt.passed = false;
      receipt.error = String(error?.stack ?? error);
      receipt.failure_stage = classifyFailure("scenario");
      await page.screenshot({path:join(here,"artifacts",`${name}-failure.png`)}).catch(()=>{});
      console.error(`  SCENARIO ERROR: ${receipt.error}`);
    }
  } catch (error) {
    // A failure acquiring setup, bridge, browser or page: no harness receipt
    // exists, so one is synthesised below rather than losing the scenario to
    // the top-level handler with no record and no classification.
    failure = { stage, error: String(error?.stack ?? error) };
    console.error(`  ${classifyFailure(stage).toUpperCase().replace(/-/g, " ")} (${stage}): ${failure.error}`);
  } finally {
    const cleanup = await disposers.disposeAll();
    if (receipt) {
      if (cleanup.errors.length) {
        receipt.cleanup_errors = cleanup.errors;
        for (const { label, error } of cleanup.errors) console.error(`  cleanup error (${label}): ${error}`);
      }
    } else {
      receipt = failedReceipt({ name, kernelScenario: spec.kernel, baseUrl, startedAt, failure, cleanup });
    }
    // Let a freed bridge port settle before the next kernel scenario claims it.
    if (spec.kernel) await sleep(500);
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
  const { names, unknown } = resolveScenarioNames(SCENARIOS, args);
  if (unknown.length) {
    console.error(`unknown scenario \`${unknown[0]}\`; known: ${Object.keys(SCENARIOS).join(", ")}, all`);
    process.exit(2);
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
    // Spawn vite directly: the npm indirection re-appends the script's own
    // --port/--strictPort, and duplicated flags have produced servers that
    // bind one port while reporting another.
    spawnService("preview", "node", ["node_modules/.bin/vite", "preview", "--port", String(PREVIEW_PORT), "--strictPort"]);
    await waitForHttp(baseUrl, "the preview server", 60_000);
  }
  console.log(`serving the cradle at ${baseUrl}${externalUrl ? " (external)" : ""}`);

  // Record how the served bytes were obtained now that the bundle is settled,
  // so every scenario receipt carries the exact build identity it exercised.
  buildInput = buildInputIdentity({ walkUrl: externalUrl, skipBuild: process.env.SKIP_BUILD === "1", distDir: join(cradleRoot, "dist") });
  console.log(`  build input: ${buildInput.mode}${buildInput.bundle_fingerprint ? ` (${buildInput.bundle_fingerprint.slice(0, 12)}…)` : ""}`);

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
