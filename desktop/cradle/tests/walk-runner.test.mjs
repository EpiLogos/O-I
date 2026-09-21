import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeRegistry,
  resolveScenarioNames,
  classifyFailure,
  DisposerStack,
  bundleFingerprint,
  buildInputIdentity,
} from "../walk/run-support.mjs";

const cradleRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// F02 alias defect: an entry without an `aliases` field must not throw when a
// later entry's alias is scanned. This is the exact page-context/fnd-04 shape.
test("resolving a later alias does not throw at an earlier entry that lacks aliases", () => {
  const registry = {
    "page-context": { module: "scenarios/page-context.mjs", kernel: true },
    material: { module: "scenarios/material.mjs", kernel: true, aliases: ["fnd-04"] },
  };
  const { names, unknown } = resolveScenarioNames(registry, ["fnd-04"]);
  assert.deepEqual(names, ["material"]);
  assert.deepEqual(unknown, []);
});

test("canonical names, aliases, all/empty and unknown diagnostics resolve distinctly", () => {
  const registry = {
    rest: { module: "scenarios/rest.mjs", aliases: ["u0.3"] },
    surfaces: { module: "scenarios/surfaces.mjs", aliases: ["u0.3b"] },
  };
  assert.deepEqual(resolveScenarioNames(registry, ["rest"]).names, ["rest"]);
  assert.deepEqual(resolveScenarioNames(registry, ["u0.3b"]).names, ["surfaces"]);
  assert.deepEqual(resolveScenarioNames(registry, []).names, ["rest", "surfaces"]);
  assert.deepEqual(resolveScenarioNames(registry, ["all"]).names, ["rest", "surfaces"]);
  assert.deepEqual(resolveScenarioNames(registry, ["nope"]).unknown, ["nope"]);
});

test("normalizeRegistry fills a missing alias list and leaves existing ones", () => {
  const registry = {
    "page-context": { module: "scenarios/page-context.mjs" },
    material: { module: "scenarios/material.mjs", aliases: ["fnd-04"] },
  };
  normalizeRegistry(registry);
  assert.deepEqual(registry["page-context"].aliases, []);
  assert.deepEqual(registry.material.aliases, ["fnd-04"]);
});

test("normalizeRegistry rejects a malformed runner rather than failing later", () => {
  // The guard the report asks for: a deliberately malformed temporary runner.
  assert.throws(() => normalizeRegistry({ x: { aliases: [] } }), /no module/);
  assert.throws(() => normalizeRegistry({ x: { module: "m.mjs", aliases: "u0.3" } }), /non-array aliases/);
  assert.throws(() => normalizeRegistry({ x: 7 }), /not a registry entry/);
  assert.throws(() => normalizeRegistry({ x: { module: "m.mjs", aliases: [""] } }), /malformed alias/);
});

test("classifyFailure keeps setup, harness and application distinct and never a pass", () => {
  assert.equal(classifyFailure("setup"), "setup-unavailable");
  assert.equal(classifyFailure("bridge"), "harness");
  assert.equal(classifyFailure("browser"), "harness");
  assert.equal(classifyFailure("page"), "harness");
  assert.equal(classifyFailure("scenario"), "application");
  assert.equal(classifyFailure(undefined), "harness");
});

test("every disposer runs in reverse even when one throws, and errors stay distinct", async () => {
  const order = [];
  const stack = new DisposerStack();
  stack.push("first", () => { order.push("first"); });
  stack.push("boom", () => { order.push("boom"); throw new Error("cleanup failed"); });
  stack.push("last", () => { order.push("last"); });
  const { errors } = await stack.disposeAll();
  assert.deepEqual(order, ["last", "boom", "first"]); // reverse of acquisition
  assert.equal(errors.length, 1);
  assert.equal(errors[0].label, "boom");
  assert.match(errors[0].error, /cleanup failed/);
});

test("a bundle fingerprint tells a changed build from an unchanged one, and empty from present", () => {
  const dir = mkdtempSync(join(tmpdir(), "oi-bundle-"));
  try {
    assert.equal(bundleFingerprint(join(dir, "dist")), null); // no bundle yet
    mkdirSync(join(dir, "dist", "assets"), { recursive: true });
    writeFileSync(join(dir, "dist", "index.html"), "<!doctype html>");
    writeFileSync(join(dir, "dist", "assets", "index-aaaa.js"), "console.log(1)");
    const first = bundleFingerprint(join(dir, "dist"));
    assert.equal(bundleFingerprint(join(dir, "dist")), first); // stable
    writeFileSync(join(dir, "dist", "assets", "index-bbbb.js"), "console.log(2)"); // vite renames on content change
    assert.notEqual(bundleFingerprint(join(dir, "dist")), first); // a stale reuse is now detectable
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("build input identity names how the served bytes were obtained", () => {
  assert.equal(buildInputIdentity({ walkUrl: "http://staging", skipBuild: false }).mode, "external-url");
  const dir = mkdtempSync(join(tmpdir(), "oi-build-"));
  try {
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "dist", "index.html"), "x");
    assert.equal(buildInputIdentity({ skipBuild: true, distDir: join(dir, "dist") }).mode, "reused-dist");
    assert.equal(buildInputIdentity({ skipBuild: false, distDir: join(dir, "dist") }).mode, "fresh-build");
    assert.ok(buildInputIdentity({ skipBuild: true, distDir: join(dir, "dist") }).bundle_fingerprint);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the real runner registry validates and reports an unknown scenario cleanly", () => {
  // Runs the actual runner against a bogus name: it resolves names before any
  // build, so this exits 2 with a diagnostic and never launches a browser. It
  // proves the real SCENARIOS registry passes normalizeRegistry (a malformed
  // registry would exit 1 with a different error) and that every registered
  // scenario is therefore resolvable.
  try {
    execFileSync("node", ["walk/run.mjs", "__definitely_not_a_scenario__"], { cwd: cradleRoot, encoding: "utf8", stdio: "pipe" });
    assert.fail("expected a non-zero exit for an unknown scenario");
  } catch (error) {
    assert.equal(error.status, 2);
    assert.match(String(error.stderr), /unknown scenario `__definitely_not_a_scenario__`/);
  }
});
