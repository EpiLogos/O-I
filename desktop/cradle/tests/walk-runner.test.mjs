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

// The cleanup sweep (O-I ticket 869): a walk that goes takes its workflow steps with it. Every walk a workflow runs is a
// file in this tree, and every walk-evidence directory a workflow keeps is one a walk in this tree writes (or the step
// names it itself). A step for a walk that is gone runs nothing and keeps nothing, so it reads as proof that is not there.
test("every walk a workflow runs, and every walk evidence it keeps, belongs to a walk in the tree", async () => {
  const { readdirSync, readFileSync, existsSync, statSync } = await import("node:fs");
  const repo = join(cradleRoot, "..", "..");
  const workflows = join(repo, ".github", "workflows");
  const texts = [];
  const gather = dir => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "artifacts") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) gather(path);
      else if (/\.(mjs|js|ts|tsx|py|sh)$/.test(name)) texts.push(readFileSync(path, "utf8"));
    }
  };
  gather(join(cradleRoot, "tests"));
  gather(join(cradleRoot, "walk"));
  const faults = [];
  for (const file of readdirSync(workflows).filter(name => name.endsWith(".yml"))) {
    const text = readFileSync(join(workflows, file), "utf8");
    const dirs = [...text.matchAll(/working-directory:\s*(\S+)/g)].map(m => m[1]);
    const outside = dirs.some(dir => !existsSync(join(repo, dir)));
    for (const [, path] of text.matchAll(/(?:^|\s)(?:node|python3)\s+((?:tests|walk)\/[\w./-]+\.(?:mjs|py))/gm)) {
      const found = [repo, ...dirs.map(dir => join(repo, dir)), cradleRoot, join(repo, "packages/live-shell/ui")].some(base => existsSync(join(base, path)));
      if (!found && !outside) faults.push(`${file} runs ${path}, which is not in the tree`);
    }
    for (const line of text.split("\n")) {
      for (const [, name] of line.matchAll(/(?:tests|walk)\/artifacts\/([\w.-]+)/g)) {
        if (/=\S*artifacts\//.test(line)) continue;
        const written = texts.some(source => new RegExp(`['"/]${name.replace(/[.]/g, "\\.")}['"/]`).test(source));
        if (!written) faults.push(`${file} keeps artifacts/${name}, which no walk in the tree writes`);
      }
    }
  }
  assert.deepEqual(faults, []);
});
