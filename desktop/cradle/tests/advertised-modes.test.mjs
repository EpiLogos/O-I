// A2 — Settings offers, per connection, exactly the permission modes that
// connection's harness was seen advertising; nothing is claimed otherwise.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/advertised-modes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k)};
const M = await import("../src/encounter/advertisedModes.ts");

test("an empty memory claims nothing", () => {
  store.clear(); M.resetAdvertisedModesForTest();
  assert.deepEqual(M.advertisedModes(), []);
});

test("a read records the connection's own modes, and 'offers none' is recorded too", () => {
  store.clear(); M.resetAdvertisedModesForTest();
  let told = 0; M.watchAdvertisedModes(() => told++);
  M.recordAdvertisedModes("hermes-probe", "Hermes", [{id: "default", name: "Default", description: "x"}, {id: "accept_edits", name: "Accept edits"}], 1000);
  M.recordAdvertisedModes("pi", "Pi", [], 2000);
  assert.equal(told, 2);
  assert.deepEqual(M.advertisedModes().map((row) => [row.provider, row.modes.map((m) => m.id)]), [["hermes-probe", ["default", "accept_edits"]], ["pi", []]]);
  assert.equal(M.advertisedModes()[0].modes[0].description, undefined, "only id and name are kept");
  // A reload discards owner capability observations until the next native read.
  M.resetAdvertisedModesForTest();
  assert.deepEqual(M.advertisedModes(), []);
});

test("an identical re-read within a minute does not churn; a changed advertisement replaces the old one", () => {
  store.clear(); M.resetAdvertisedModesForTest();
  let told = 0; M.watchAdvertisedModes(() => told++);
  M.recordAdvertisedModes("h", "Hermes", [{id: "default", name: "Default"}], 1000);
  M.recordAdvertisedModes("h", "Hermes", [{id: "default", name: "Default"}], 2000);
  assert.equal(told, 1);
  M.recordAdvertisedModes("h", "Hermes", [{id: "plan", name: "Plan"}], 3000);
  assert.equal(told, 2);
  assert.deepEqual(M.advertisedModes()[0].modes.map((m) => m.id), ["plan"]);
});

test("historical browser capability data cannot confer current modes", () => {
  store.clear(); M.resetAdvertisedModesForTest();
  store.set("oi-cradle.advertised-modes.v1", JSON.stringify({x: {label: "X", modes: [{id: 3}]}, y: {label: "Y", modes: [{id: "a", name: "A"}], seenAt: 5}}));
  assert.deepEqual(M.advertisedModes(), []);
  store.set("oi-cradle.advertised-modes.v1", "{not json"); M.resetAdvertisedModesForTest();
  assert.deepEqual(M.advertisedModes(), []);
});
