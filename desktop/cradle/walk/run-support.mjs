/**
 * Pure runner support (F02): the parts of the walk runner that can be proved
 * without a browser, a bridge or a provider. Kept beside run.mjs so the runner
 * imports exactly this logic and the regression test exercises the same code,
 * not a paraphrase of it.
 */

import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A scenario registry entry that reaches the runner must name a module and
 * carry an alias list. A missing `aliases` is normalised to an empty list so
 * an alias scan never reads `undefined.includes` (the page-context defect);
 * anything else malformed is rejected loudly rather than failing later as a
 * misleading scenario error. Returns the same object for convenience.
 */
export function normalizeRegistry(scenarios) {
  if (!scenarios || typeof scenarios !== "object") throw new Error("the scenario registry must be an object");
  for (const [name, spec] of Object.entries(scenarios)) {
    if (!spec || typeof spec !== "object") throw new Error(`scenario \`${name}\` is not a registry entry`);
    if (typeof spec.module !== "string" || !spec.module) throw new Error(`scenario \`${name}\` has no module`);
    if (spec.aliases === undefined) spec.aliases = [];
    if (!Array.isArray(spec.aliases)) throw new Error(`scenario \`${name}\` has a non-array aliases field`);
    for (const alias of spec.aliases) if (typeof alias !== "string" || !alias) throw new Error(`scenario \`${name}\` has a malformed alias`);
  }
  return scenarios;
}

/**
 * Resolve requested names/aliases against the registry. Pure: it reports what
 * it found and what it could not, and lets the caller decide how to exit. An
 * empty request or `all` returns every canonical name in registry order.
 */
export function resolveScenarioNames(scenarios, args) {
  if (args.length === 0 || args.includes("all")) return { names: Object.keys(scenarios), unknown: [] };
  const names = [];
  const unknown = [];
  for (const arg of args) {
    const canonical = scenarios[arg]
      ? arg
      : Object.keys(scenarios).find((n) => (scenarios[n].aliases ?? []).includes(arg));
    if (canonical) names.push(canonical);
    else unknown.push(arg);
  }
  return { names, unknown };
}

/**
 * Where a scenario failed decides how its receipt reads. Setup that could not
 * provision is `setup-unavailable`; a bridge/browser/page that could not start
 * is a `harness` failure; a scenario body assertion is an `application`
 * failure. None of these is ever a pass — the distinction only tells the
 * reader whether the product or the harness is what broke.
 */
export function classifyFailure(stage) {
  switch (stage) {
    case "setup": return "setup-unavailable";
    case "bridge":
    case "browser":
    case "page": return "harness";
    case "scenario": return "application";
    default: return "harness";
  }
}

/**
 * Disposers registered as resources are acquired, torn down in reverse on the
 * way out. Each disposer is guarded so one failure never strands the rest, and
 * the errors it collects stay separate from the scenario's own failure — a
 * cleanup throw must not overwrite or hide the primary result.
 */
export class DisposerStack {
  #disposers = [];
  push(label, dispose) {
    this.#disposers.push({ label, dispose });
  }
  async disposeAll() {
    const errors = [];
    for (const { label, dispose } of this.#disposers.reverse()) {
      try {
        await dispose();
      } catch (error) {
        errors.push({ label, error: String(error?.stack ?? error) });
      }
    }
    this.#disposers = [];
    return { errors };
  }
}

/**
 * A digest of the working tree's dirty state — status and diff, hashed, never
 * the contents themselves. It lets a receipt bind its result to the exact
 * uncommitted state that produced it without publishing private source.
 */
export function dirtyTreeDigest(runGit) {
  const status = runGit(["status", "--porcelain=v1"]);
  const diff = runGit(["diff", "HEAD"]);
  return createHash("sha256").update(status).update("\0").update(diff).digest("hex");
}

/**
 * A fingerprint of a served bundle. Vite emits content-hashed asset names, so
 * the sorted file inventory (path and size) already changes whenever the built
 * bytes change — enough to tell a reused stale bundle from a current one in a
 * receipt, without banning legitimate SKIP_BUILD caching.
 */
export function bundleFingerprint(distDir) {
  const entries = [];
  const walk = (dir, prefix) => {
    let listing;
    try {
      listing = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of listing.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) entries.push(`${rel}\0${statSync(full).size}`);
    }
  };
  walk(distDir, "");
  if (!entries.length) return null;
  return createHash("sha256").update(entries.join("\n")).digest("hex");
}

/**
 * How the served bytes were obtained, recorded so a source-specific proof can
 * reject a bundle that does not match current source. An external URL is
 * marked as such (its bytes are not ours to fingerprint); a reused local dist
 * carries its fingerprint; a fresh build is named fresh.
 */
export function buildInputIdentity({ walkUrl, skipBuild, distDir }) {
  if (walkUrl) return { mode: "external-url", url: walkUrl, bundle_fingerprint: null };
  if (skipBuild) return { mode: "reused-dist", bundle_fingerprint: bundleFingerprint(distDir) };
  return { mode: "fresh-build", bundle_fingerprint: bundleFingerprint(distDir) };
}
