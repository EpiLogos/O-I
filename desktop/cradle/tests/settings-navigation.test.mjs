import test from "node:test";
import assert from "node:assert/strict";
import {goTo, settingsNav, subscribeSettingsNav, restoreSettingsPlace, samePlace} from "../src/workspace/settings/settingsNav.ts";

test("saved Models destinations recover to the working Harnesses page", () => {
  assert.deepEqual(restoreSettingsPlace(JSON.parse('{"kind":"section","id":"models"}')), {kind: "section", id: "harnesses"});
  assert.deepEqual(restoreSettingsPlace({kind: "section", id: "credentials"}), {kind: "section", id: "credentials"});
  assert.deepEqual(restoreSettingsPlace({kind: "product", id: "ai-kit"}), {kind: "product", id: "ai-kit"});
  for (const invalid of [null, 42, [], {kind: "section", id: "removed-page"}]) assert.deepEqual(restoreSettingsPlace(invalid), {kind: "section", id: "status"});
});

test("legacy navigation publishes canonical selection and retains exact search focus", () => {
  const seen = [];
  const unsubscribe = subscribeSettingsNav(() => seen.push(settingsNav()));
  const first = settingsNav().focusSeq;
  goTo({kind: "section", id: "models"}, "model:catalogue");
  assert.equal(seen.length, 1);
  assert.equal(samePlace(seen[0].place, {kind: "section", id: "harnesses"}), true);
  assert.equal(seen[0].focusRow, "model:catalogue");
  goTo({kind: "section", id: "harnesses"}, "model:catalogue");
  assert.equal(seen[1].focusSeq, first + 2, "repeating a search still triggers its landing");
  goTo({kind: "section", id: "credentials"});
  assert.equal(samePlace(settingsNav().place, {kind: "section", id: "harnesses"}), false);
  assert.equal(settingsNav().focusRow, null);
  unsubscribe();
});
