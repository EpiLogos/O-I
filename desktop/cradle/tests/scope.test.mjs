// The one scope (10-SIDEBARS §3.6, ruling D6): chosen in one place, read everywhere.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/scope.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
const S = await import("../src/workspace/scope.ts");

test("the workspace's project maps to exactly one scope", () => {
  assert.deepEqual(S.scopeFromWorkspace(undefined), {kind: "central"});
  assert.deepEqual(S.scopeFromWorkspace("O-I"), {kind: "project", project: "O-I"});
  assert.deepEqual(S.scopeFromWorkspace("O-I", true), {kind: "all"});
  assert.equal(S.scopeLabel({kind: "all"}), "All projects");
  assert.equal(S.scopeProject({kind: "central"}), undefined);
});

test("choosing goes through the bound writer; readers see only what the frame publishes", () => {
  const seen = [];
  const off = S.subscribeScope(() => seen.push(S.readScope()));
  const written = [];
  const unbind = S.bindScopeWriter(scope => written.push(scope));
  S.chooseScope({kind: "project", project: "ai-kit"});
  assert.deepEqual(written, [{kind: "project", project: "ai-kit"}]);
  assert.deepEqual(S.readScope(), {kind: "central"}, "a choice is not the scope until the owner publishes it");
  S.publishScope({kind: "project", project: "ai-kit"});
  S.publishScope({kind: "project", project: "ai-kit"});
  assert.equal(seen.length, 1, "an unchanged scope notifies nobody");
  unbind(); off();
  S.chooseScope({kind: "central"});
  assert.deepEqual(S.readScope(), {kind: "central"}, "without a writer the choice publishes directly");
});
