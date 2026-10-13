/**
 * snapPosition (m0m5/canvas/interactions.ts): centre-only snapping must stay
 * byte-identical to the original algorithm when no box sizes are given, and
 * the edge-aware path (options.boxes) aligns the dragged box's edges and
 * centres to the other boxes' edges and centres, naming the line it used.
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/techne-canvas-interactions.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { snapPosition } = await import("../src/techne/m0m5/canvas/interactions.ts");

/** The original centre-only snapPosition, kept verbatim as the reference. */
function legacySnapPosition(position, others, draggedRef, threshold, options = {}) {
  let bestAxis = null;
  let bestAt = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const consider = (axis, at) => {
    const distance = Math.abs((axis === "x" ? position.x : position.y) - at);
    if (distance <= threshold && distance < bestDistance) {
      bestAxis = axis;
      bestAt = at;
      bestDistance = distance;
    }
  };
  for (const other of others) {
    if (other.ref === draggedRef) continue;
    consider("x", other.x);
    consider("y", other.y);
  }
  if (options.snapToOrigin) {
    consider("x", 0);
    consider("y", 0);
  }
  if (bestAxis === null) return { position, guides: [] };
  const tidy = (value) => Math.round(value * 1e5) / 1e5;
  const snapped = bestAxis === "x"
    ? { x: tidy(bestAt), y: position.y }
    : { x: position.x, y: tidy(bestAt) };
  return { position: snapped, guides: [{ axis: bestAxis, at: bestAt }] };
}

/** Deterministic pseudo-random numbers in [0, 1). */
function rng(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

test("centre-only snapping matches the original algorithm exactly when no sizes are given", () => {
  const next = rng(11);
  for (let trial = 0; trial < 3000; trial += 1) {
    const count = 1 + Math.floor(next() * 6);
    const others = Array.from({ length: count }, (_, index) => ({
      ref: `n${index}`,
      x: Math.round(next() * 2000 - 1000),
      y: Math.round(next() * 2000 - 1000),
      radius: 0,
    }));
    const position = { x: next() * 2000 - 1000, y: next() * 2000 - 1000 };
    const threshold = next() * 60;
    const options = next() < 0.3 ? { snapToOrigin: true } : {};
    const actual = snapPosition(position, others, "n0", threshold, options);
    const expected = legacySnapPosition(position, others, "n0", threshold, options);
    assert.deepEqual(actual, expected, `trial ${trial}`);
  }
});

test("an empty boxes option with no sizes still reads as centre-only", () => {
  const others = [{ ref: "a", x: 100, y: 40, radius: 0 }];
  const plain = snapPosition({ x: 103, y: 60 }, others, "dragged", 8);
  const withEmptyBoxes = snapPosition({ x: 103, y: 60 }, others, "dragged", 8, {
    boxes: { dragged: { width: 0, height: 0 }, others: {} },
  });
  assert.deepEqual(withEmptyBoxes.guides, plain.guides);
  assert.deepEqual(withEmptyBoxes.guides, [{ axis: "x", at: 100 }]);
});

test("the dragged box's left edge aligns to another box's left edge and the guide names that line", () => {
  // Other box: centre 300, 200 wide, so left 200 and right 400. Dragged: 120 wide, centre 262, so left 202.
  // Left-to-left is 2 away; every centre and right-edge candidate is further. The y axis is kept far away.
  const others = [{ ref: "a", x: 300, y: 0, radius: 0 }];
  const result = snapPosition({ x: 262, y: 1000 }, others, "dragged", 8, {
    boxes: { dragged: { width: 120, height: 100 }, others: { a: { width: 200, height: 100 } } },
  });
  assert.deepEqual(result.guides, [{ axis: "x", at: 200 }]);
  assert.equal(result.position.x, 260, "left edge on 200 means centre at 260");
  assert.equal(result.position.y, 1000);
});

test("the dragged box's right edge aligns to another box's right edge", () => {
  // Other box: centre 300, 200 wide, so left 200, right 400. Dragged: 60 wide, centre 372, so right 402.
  // Right-to-right is 2 away; centre-to-centre is 72 away, left-to-centre is 40 away.
  const others = [{ ref: "a", x: 300, y: 0, radius: 0 }];
  const result = snapPosition({ x: 372, y: 1000 }, others, "dragged", 8, {
    boxes: { dragged: { width: 60, height: 60 }, others: { a: { width: 200, height: 200 } } },
  });
  assert.deepEqual(result.guides, [{ axis: "x", at: 400 }]);
  assert.equal(result.position.x, 370);
});

test("on an exact tie a centre line wins over an edge line", () => {
  // Centre 304 is 4 from the other centre 300; the dragged left edge 254 is also 4 from the other left edge 250.
  const others = [{ ref: "a", x: 300, y: 0, radius: 0 }];
  const result = snapPosition({ x: 304, y: 1000 }, others, "dragged", 8, {
    boxes: { dragged: { width: 100, height: 100 }, others: { a: { width: 100, height: 100 } } },
  });
  assert.deepEqual(result.guides, [{ axis: "x", at: 300 }]);
  assert.equal(result.position.x, 300);
});

test("a ref with no size entry snaps by centre only, even when boxes are given", () => {
  const others = [
    { ref: "sized", x: 300, y: 0, radius: 0 },
    { ref: "unsized", x: 500, y: 0, radius: 0 },
  ];
  const result = snapPosition({ x: 494, y: 1000 }, others, "dragged", 8, {
    boxes: { dragged: { width: 100, height: 100 }, others: { sized: { width: 100, height: 100 } } },
  });
  assert.deepEqual(result.guides, [{ axis: "x", at: 500 }]);
  assert.equal(result.position.x, 500);
});

test("the dragged ref is never a target, with or without sizes", () => {
  const others = [{ ref: "dragged", x: 100, y: 100, radius: 0 }];
  const result = snapPosition({ x: 101, y: 101 }, others, "dragged", 8, {
    boxes: { dragged: { width: 50, height: 50 }, others: { dragged: { width: 50, height: 50 } } },
  });
  assert.deepEqual(result.guides, []);
  assert.deepEqual(result.position, { x: 101, y: 101 });
});

test("an edge outside the threshold does not snap, and the position is returned unchanged", () => {
  const others = [{ ref: "a", x: 300, y: 300, radius: 0 }];
  const position = { x: 0, y: 0 };
  const result = snapPosition(position, others, "dragged", 8, {
    boxes: { dragged: { width: 40, height: 40 }, others: { a: { width: 100, height: 100 } } },
  });
  assert.equal(result.position, position);
  assert.deepEqual(result.guides, []);
});
