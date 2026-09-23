// Object pages (10-SIDEBARS §4.7): the registry lane 3 reuses for Factory objects.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/object-registry.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
const R = await import("../src/agent/objects/registry.ts");

test("a page's identity round-trips through its surface ref, awkward characters included", () => {
  const object = {kind: "tape-event", project: "O-I", ref: "agent-session/a|b#12,13", title: "edit shell.css"};
  const encoded = R.encodeObjectRef(object);
  assert.ok(encoded.startsWith("oi-object:"));
  assert.ok(R.isObjectRef(encoded));
  assert.deepEqual(R.decodeObjectRef(encoded, "edit shell.css"), object);
  assert.deepEqual(R.decodeObjectRef(R.encodeObjectRef({kind: "agent", ref: "agent/epii", title: "Epii"}), "Epii"), {kind: "agent", ref: "agent/epii", title: "Epii"});
  assert.equal(R.decodeObjectRef("central:path:x"), undefined);
  assert.equal(R.decodeObjectRef("oi-object:||"), undefined, "no kind, no ref: no object");
});

test("kinds register once by name; the latest registration wins", async () => {
  R.registerObjectKind({kind: "test-kind", label: "Test", read: () => ({kindLabel: "Test", title: "one", fields: []})});
  R.registerObjectKind({kind: "test-kind", label: "Test 2", read: () => ({kindLabel: "Test", title: "two", fields: []})});
  assert.equal(R.objectKindOf("test-kind").label, "Test 2");
  assert.equal((await R.objectKindOf("test-kind").read({kind: "test-kind", ref: "x", title: ""}, {transport: {kind: "unavailable"}})).title, "two");
  assert.equal(R.objectKindOf("never-registered"), undefined);
});

test("⌥-click is Pop out; the open event carries identity only", () => {
  assert.deepEqual(R.openIntent({altKey: true}), {popOut: true});
  assert.deepEqual(R.openIntent({altKey: false}), {popOut: false});
  assert.ok(R.isOpenObjectDetail({object: {kind: "agent", ref: "agent/epii", title: "Epii"}}));
  assert.ok(!R.isOpenObjectDetail({object: {kind: "agent", ref: "", title: "Epii"}}));
  assert.ok(!R.isOpenObjectDetail(null));
});

test("handed material lives in this window's memory only", () => {
  R.holdHanded("seq:4", {payload: "text", kindLabel: "Kernel receipt", source: "Activity"});
  assert.equal(R.handedMaterial("seq:4").payload, "text");
  assert.equal(R.handedMaterial("seq:never"), undefined);
});
