/**
 * The live wiki reading provider (parent integration, 2026-09-22) — the leg
 * the HUD registers (ensureWikiProvider → wikiTechneReadingProvider) and the
 * fixture-backed HUD proof deliberately bypasses. Its full read runs
 * readWikiRegister over a real kernel (exercised in the app / native CI), but
 * its identity and its honest transport-unavailable path are pure and proven
 * here, so "the HUD registers the LIVE provider" is not carried by reasoning
 * alone.
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs
 *        --test tests/techne-wiki-provider.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {wikiTechneReadingProvider} = await import("../src/techne/wikiReadingProvider.ts");

test("the wiki reading provider carries the stable live ref the HUD binds", () => {
  const provider = wikiTechneReadingProvider({kind: "unavailable", reason: "no kernel here"});
  assert.equal(provider.ref, "oi-cradle.wiki-reading/v1");
});

test("an unavailable transport makes read() reject with the owner's reason — the honest live-unavailable path", async () => {
  const provider = wikiTechneReadingProvider({kind: "unavailable", reason: "the kernel transport is unavailable in this window"});
  await assert.rejects(
    () => provider.read({ref: "wiki:central", kind: "wiki-register", title: "Central"}),
    /the kernel transport is unavailable in this window/,
  );
});
