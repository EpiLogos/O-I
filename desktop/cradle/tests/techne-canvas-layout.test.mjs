/**
 * G1 (techne-inheritance-restoration, owner commission M1 geometry, QL-MEF
 * #214 geometry-closeout): proves the Canvas/Constellation layout
 * (m0m5/canvas/layout.ts) never guesses a sixfold ring from member
 * cardinality or array order — a warranted `ql` reading with no DECLARED
 * member position stays "radial" (open arrangement, no QL form implied),
 * and only a genuinely declared position (passed in via
 * `declaredPositions`, never derived from `member_refs` index) ever
 * selects the "ql-constellation" scheme. Mirrors the same declared-position
 * law `wikiExpression.ts` already proves for the Wiki→Expression sibling
 * (tests/techne-geometry.test.mjs).
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs
 *        --test tests/techne-canvas-layout.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { computeLayout, applyManualOverrides, MEMBER_RING_RADIUS } = await import(
  "../src/techne/m0m5/canvas/layout.ts"
);

function reading({ memberRefs = [], relations = [], ql } = {}) {
  return {
    contract: "ql.techne/v1",
    reading_ref: "ql.techne:reading:fixture:canvas-layout@1",
    snapshot: { revision: null },
    subject: { subject_ref: "fixture:subject:whole", native_owner: "fixture" },
    whole: { whole_ref: "fixture:subject:whole", member_refs: memberRefs, relations },
    ...(ql ? { ql } : {}),
    disclosure: { instruments: [] },
  };
}

const warrant = {
  result_class: "deterministic",
  evidence_refs: ["fixture:evidence:1"],
  provenance_ref: "fixture:provider:1",
};

test("six members with a warranted ql facet but NO declared position stay 'radial' — never a sixfold ring guessed from member count or index", () => {
  const input = reading({
    memberRefs: ["m:a", "m:b", "m:c", "m:d", "m:e", "m:f"],
    ql: { shape_ref: "ql:shape:1.0.0:6x6:direct-conjugate", warrant },
  });
  const layout = computeLayout(input);
  assert.equal(layout.scheme, "radial", "a warranted ql facet alone must not select the sixfold scheme");
  for (const node of layout.nodes) {
    if (node.role === "member") assert.equal(node.position, null, `${node.ref} must carry no guessed position`);
  }
});

test("a DECLARED position on even one member selects 'ql-constellation' — the declaration, not the count, decides", () => {
  const input = reading({
    memberRefs: ["m:a", "m:b", "m:c"],
    ql: { shape_ref: "ql:shape:1.0.0:6x6:direct-conjugate", warrant },
  });
  const layout = computeLayout(input, { "m:a": 2 });
  assert.equal(layout.scheme, "ql-constellation");
  const declared = layout.nodes.find((n) => n.ref === "m:a");
  assert.equal(declared.position, 2, "the member's own declared position is used, not a derived index");
  const expected = { x: Math.cos((-90 + 60 * 2) * Math.PI / 180) * MEMBER_RING_RADIUS, y: Math.sin((-90 + 60 * 2) * Math.PI / 180) * MEMBER_RING_RADIUS };
  assert.ok(Math.abs(declared.x - expected.x) < 1e-9 && Math.abs(declared.y - expected.y) < 1e-9);
});

test("an undeclared member inside an otherwise-warranted constellation keeps position null — it is not backfilled into the ring by its index", () => {
  const input = reading({
    memberRefs: ["m:a", "m:b"],
    ql: { shape_ref: "ql:shape:1.0.0:6x6:direct-conjugate", warrant },
  });
  const layout = computeLayout(input, { "m:a": 0 });
  const undeclared = layout.nodes.find((n) => n.ref === "m:b");
  assert.equal(undeclared.position, null, "an undeclared member must present as undeclared, never guessed from its array slot");
});

test("the reading's own warranted ql.address anchors independently of member declarations — it is the warrant's own coordinate, not a member guess", () => {
  const input = reading({
    memberRefs: ["m:a"],
    ql: { address: "ql:structural:2.0.0:field:A:1:D3", shape_ref: "ql:shape:1.0.0:6x6:direct-conjugate", warrant },
  });
  const layout = computeLayout(input);
  assert.equal(layout.scheme, "radial", "no member declared a position, so the member scheme stays open");
  const anchor = layout.nodes.find((n) => n.role === "ql-address");
  assert.ok(anchor, "the warranted address still anchors even though no member position was declared");
  assert.equal(anchor.ref, "ql:structural:2.0.0:field:A:1:D3");
});

test("no ql facet at all is 'radial' with no address anchor", () => {
  const input = reading({ memberRefs: ["m:a", "m:b"] });
  const layout = computeLayout(input);
  assert.equal(layout.scheme, "radial");
  assert.equal(layout.nodes.some((n) => n.role === "ql-address"), false);
});

test("same input, same declared positions → same output (deterministic, no clocks or randomness)", () => {
  const input = reading({
    memberRefs: ["m:a", "m:b", "m:c", "m:d", "m:e", "m:f", "m:g"],
    ql: { shape_ref: "ql:shape:1.0.0:6x6:direct-conjugate", warrant },
  });
  const declared = { "m:a": 0, "m:b": 1, "m:g": 7 };
  const first = computeLayout(input, declared);
  const second = computeLayout(input, declared);
  assert.deepEqual(first, second);
  // position 7 continues the same six angles on an outer ring (ring 1).
  const outer = first.nodes.find((n) => n.ref === "m:g");
  assert.equal(outer.position, 1);
  assert.equal(outer.ring, 1);
});

test("applyManualOverrides layers presentation-only positions and never mutates the computed layout's scheme or the reading", () => {
  const input = reading({
    memberRefs: ["m:a"],
    ql: { shape_ref: "ql:shape:1.0.0:6x6:direct-conjugate", warrant },
  });
  const layout = computeLayout(input, { "m:a": 0 });
  const moved = applyManualOverrides(layout, { "m:a": { x: 5, y: 5 } });
  assert.equal(moved.scheme, layout.scheme);
  assert.deepEqual(moved.nodes.find((n) => n.ref === "m:a"), { ...layout.nodes.find((n) => n.ref === "m:a"), x: 5, y: 5 });
  assert.notEqual(moved, layout);
});
