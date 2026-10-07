// Craft lane 3 — symbolon spine re-craft. The prior pass staged notation
// triads drowned in editorial panels on one palette. This re-craft draws each
// determination as a field: the slash as a leaning stroke between placements,
// the All as held plurality, the catuskoti corners flashing their words and
// returning to bare squares, the breathing of −/+, the X drawn in crossed
// strokes, the personed copula, ∞ as twin circuits with dx vanishing, the
// return of the mark, the One circled by the many, the # grid with its
// stations, A = A in twin appearances, the Ø traversal run along a drawn path,
// and the envelope closing in 3d. Five held grounds; seven turns.
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_PARAMS } from "../../packages/oi-design-system/expressions-engine/shell/model.mjs";

const JP = "desktop/cradle/expressions-app/collections/return-of-zero/symbolon/roz-symbolon-spine.journey.json";
const BP = "desktop/cradle/expressions-app/collections/return-of-zero/symbolon/bindings/roz-symbolon-spine.binding.json";

const j = JSON.parse(readFileSync(JP, "utf8"));
const b = JSON.parse(readFileSync(BP, "utf8"));

const params = (over = {}) => ({ ...DEFAULT_PARAMS, speed: 0.6, turbulence: 0.2, dispersion: 0.09, contrast: 0.92, ...over });
const force = (strength = 0, kind = "attract", spin = 0, radius = 0.45) => ({ kind, strength, radius, spin });
const base = (id, name, shape, position, size, tint, extra = {}) => ({
  id, name, kind: "formation", position, size, rotation: 0, shape, text: "",
  share: 1, tint, tintWeight: 0.8, locked: false, force: force(), station: null,
  sequence: { enabled: false, clock: "seconds", steps: [{ id: id + "-st0", text: "", shape, hold: 3, transition: 1, position: null }] },
  ...extra,
});
const seq = (e, steps) => {
  e.sequence = { enabled: true, clock: "seconds", order: "loop", easing: "smoothstep", steps: steps.map((s, i) => ({ id: `${e.id}-st${i}`, text: s.text ?? "", shape: s.shape ?? e.shape, hold: s.hold ?? 2.6, transition: s.transition ?? 1, position: s.position ?? null, ...(s.objectState ? { objectState: s.objectState } : {}) })) };
  return e;
};
const os = (rotation, size, tint, tintWeight) => ({ size, rotation, tint, tintWeight, force: force() });
const txt = (id, text, position, size, tint, extra = {}) => ({
  id, name: id, kind: "formation", position, size, rotation: 0, shape: "text", text,
  share: 1, tint, tintWeight: 0.8, locked: false, force: force(), station: null,
  sequence: { enabled: false, clock: "seconds", steps: [{ id: id + "-st0", text, shape: "text", hold: 3, transition: 1, position: null }] },
  ...extra,
});
const remnant = (tint) => base("spine-remnant", "whole-remnant", "ring", { x: 0.95, y: 0.78, z: 0 }, { x: 0.26, y: 0.26 }, tint, { tintWeight: 0.5, share: 0.5 });
const view2d = (zoom = 1) => ({ mode: "2d", yaw: 0, pitch: 0, zoom, panX: 0, panY: 0 });

const scenes = new Map(j.scenes.map((s) => [s.id, s]));
const P0 = "#e9e5d9";

// 1 — the-slash: two placements, one leaning stroke. The slash drawn.
{
  const s = scenes.get("the-slash");
  s.field = { background: "#101216", palette: ["#e9e5d9", "#8b98a8"], material: "ink", params: params({ speed: 0.5, turbulence: 0.18, dispersion: 0.06, contrast: 0.9 }) };
  s.view = view2d();
  const stroke = base("slash-stroke", "the stroke", "square", { x: 0, y: 0, z: 0 }, { x: 0.16, y: 0.78 }, P0, { rotation: 14, tintWeight: 0.95, share: 2 });
  seq(stroke, [
    { objectState: os(0, { x: 0.16, y: 0.78 }, P0, 0.95), hold: 2.6 },
    { objectState: os(14, { x: 0.16, y: 0.78 }, P0, 0.95), hold: 3.4 },
  ]);
  s.entities = [
    base("slash-field", "the unmarked field", "ring", { x: 0, y: 0, z: 0 }, { x: 1.9, y: 1.9 }, "#8b98a8", { tintWeight: 0.25, share: 1 }),
    base("slash-dash-a", "the first placement", "disc", { x: -0.42, y: 0.05, z: 0 }, { x: 0.3, y: 0.085 }, P0, { tintWeight: 0.9 }),
    stroke,
    base("slash-dash-b", "the second placement", "disc", { x: 0.42, y: -0.05, z: 0 }, { x: 0.3, y: 0.085 }, P0, { tintWeight: 0.9 }),
    txt("slash-glyph", "/", { x: 0, y: -0.55, z: 0 }, { x: 0.12, y: 0.34 }, P0, { tintWeight: 0.7 }),
    remnant("#8b98a8"),
  ];
  s.text = [];
}

// 2 — 0-1: the One articulating through the polyvalent All.
{
  const s = scenes.get("0-1");
  s.field = { background: "#14161a", palette: ["#e9e5d9", "#c9a25c"], material: "ink", params: params({ speed: 0.55, turbulence: 0.2, dispersion: 0.08 }) };
  s.view = view2d(1.06);
  const one = base("one-disc", "the singular One", "disc", { x: 0, y: 0, z: 0 }, { x: 0.16, y: 0.16 }, P0, { tintWeight: 0.95, share: 2 });
  seq(one, [
    { objectState: os(0, { x: 0.16, y: 0.16 }, P0, 0.95), hold: 3 },
    { objectState: os(0, { x: 0.21, y: 0.21 }, P0, 0.95), hold: 2.5, transition: 1.2 },
    { objectState: os(0, { x: 0.16, y: 0.16 }, P0, 0.95), hold: 3, transition: 1.2 },
  ]);
  const rim = (x, y) => base("many-" + x + "-" + y, "the many held", "disc", { x, y, z: 0 }, { x: 0.085, y: 0.085 }, "#c9a25c", { tintWeight: 0.7, share: 0.6 });
  s.entities = [
    base("all-ring", "the polyvalent All", "ring", { x: 0, y: 0, z: 0 }, { x: 1.5, y: 1.5 }, "#c9a25c", { tintWeight: 0.4, share: 1.5 }),
    one,
    rim(0, 0.62), rim(-0.54, -0.31), rim(0.54, -0.31),
    txt("zero-glyph", "0", { x: -0.38, y: -0.55, z: 0 }, { x: 0.2, y: 0.26 }, P0),
    txt("slash-glyph", "/", { x: 0, y: -0.55, z: 0 }, { x: 0.1, y: 0.3 }, P0),
    txt("one-glyph", "1", { x: 0.38, y: -0.55, z: 0 }, { x: 0.16, y: 0.24 }, P0),
    remnant("#c9a25c"),
  ];
  s.text = [];
}

// 3 — question-assertion: the four corners of held predication, each flashing
// its word and returning to a bare square; SILENCE drawn as the ground beneath.
// Field held identical to 0-1 (still pair).
{
  const s = scenes.get("question-assertion");
  s.field = JSON.parse(JSON.stringify(scenes.get("0-1").field));
  s.view = view2d(1.06);
  const corner = (id, name, x, y, tint, word) => {
    const e = base(id, name, "square", { x, y, z: 0 }, { x: 0.28, y: 0.28 }, tint, { tintWeight: 0.7, share: 1 });
    return seq(e, [
      { hold: 2.8 },
      { shape: "text", text: word, hold: 2.2 },
    ]);
  };
  s.entities = [
    txt("q-glyph", "?", { x: -0.14, y: 0.02, z: 0 }, { x: 0.3, y: 0.4 }, "#a89ec9", { tintWeight: 0.9 }),
    txt("excl-glyph", "!", { x: 0.14, y: 0.02, z: 0 }, { x: 0.22, y: 0.4 }, "#c9a25c", { tintWeight: 0.9 }),
    txt("slash-glyph", "/", { x: 0, y: 0.02, z: 0 }, { x: 0.1, y: 0.52 }, P0, { tintWeight: 0.8 }),
    corner("corner-is", "the corner of assertion", 0.62, 0.44, "#c9a25c", "IS"),
    corner("corner-is-not", "the corner of negation", -0.62, 0.44, "#a89ec9", "IS-NOT"),
    corner("corner-both", "the corner of both", -0.62, -0.42, "#8b98a8", "BOTH"),
    corner("corner-neither", "the corner of neither", 0.62, -0.42, "#6a8c74", "NEITHER"),
    base("silence-disc", "the silence beneath", "disc", { x: 0, y: -0.72, z: 0 }, { x: 1.5, y: 0.3 }, "#6a6458", { tintWeight: 0.25, share: 0.6 }),
    remnant("#c9a25c"),
  ];
  s.text = [];
}

// 4 — minus-plus: the field breathes; the reserve contracts as the issue extends.
{
  const s = scenes.get("minus-plus");
  s.field = { background: "#1a1614", palette: ["#d8e2dc", "#3d5a5e"], material: "ink", params: params({ speed: 0.7, turbulence: 0.3, dispersion: 0.12, contrast: 0.88 }) };
  s.view = view2d();
  const reserve = base("reserve-disc", "the reserve", "disc", { x: -0.45, y: 0, z: 0 }, { x: 0.55, y: 0.55 }, "#3d5a5e", { tintWeight: 0.8, share: 1.5 });
  seq(reserve, [
    { objectState: os(0, { x: 0.55, y: 0.55 }, "#3d5a5e", 0.8), hold: 3 },
    { objectState: os(0, { x: 0.34, y: 0.34 }, "#3d5a5e", 0.85), hold: 3, transition: 1.4 },
    { objectState: os(0, { x: 0.55, y: 0.55 }, "#3d5a5e", 0.8), hold: 3, transition: 1.4 },
  ]);
  const issue = base("issue-disc", "the issue", "disc", { x: 0.45, y: 0, z: 0 }, { x: 0.34, y: 0.34 }, "#d8e2dc", { tintWeight: 0.85, share: 1.5 });
  seq(issue, [
    { objectState: os(0, { x: 0.34, y: 0.34 }, "#d8e2dc", 0.85), hold: 3 },
    { objectState: os(0, { x: 0.55, y: 0.55 }, "#d8e2dc", 0.85), hold: 3, transition: 1.4 },
    { objectState: os(0, { x: 0.34, y: 0.34 }, "#d8e2dc", 0.85), hold: 3, transition: 1.4 },
  ]);
  s.entities = [
    base("breath-field", "the breathing field", "ring", { x: 0, y: 0, z: 0 }, { x: 1.75, y: 1.75 }, "#3d5a5e", { tintWeight: 0.2, share: 1 }),
    reserve,
    issue,
    txt("minus-glyph", "−", { x: -0.16, y: 0.46, z: 0 }, { x: 0.18, y: 0.07 }, "#d8e2dc"),
    txt("slash-glyph", "/", { x: 0, y: 0.46, z: 0 }, { x: 0.08, y: 0.3 }, "#d8e2dc"),
    txt("plus-glyph", "+", { x: 0.16, y: 0.46, z: 0 }, { x: 0.16, y: 0.18 }, "#d8e2dc"),
    remnant("#3d5a5e"),
  ];
  s.text = [];
}

// 5 — X-x: capacity drawn as crossed strokes; instances arising and dissolving.
// Field held identical to minus-plus (still pair).
{
  const s = scenes.get("X-x");
  s.field = JSON.parse(JSON.stringify(scenes.get("minus-plus").field));
  s.view = view2d();
  const inst = (id, x, y) => base(id, "an instance arising", "disc", { x, y, z: 0 }, { x: 0.09, y: 0.09 }, "#8fa8a4", { tintWeight: 0.7, share: 0.6 });
  const first = inst("x-instance-1", 0.62, -0.3);
  seq(first, [
    { objectState: os(0, { x: 0.09, y: 0.09 }, "#8fa8a4", 0.7), hold: 2.5 },
    { objectState: os(0, { x: 0.13, y: 0.13 }, "#8fa8a4", 0.8), hold: 2, transition: 1.1 },
    { objectState: os(0, { x: 0.09, y: 0.09 }, "#8fa8a4", 0.7), hold: 2.5, transition: 1.1 },
  ]);
  s.entities = [
    base("x-stroke-a", "the first stroke of capacity", "square", { x: -0.42, y: 0, z: 0 }, { x: 0.12, y: 0.6 }, "#d8e2dc", { rotation: 32, tintWeight: 0.85 }),
    base("x-stroke-b", "the second stroke of capacity", "square", { x: -0.42, y: 0, z: 0 }, { x: 0.12, y: 0.6 }, "#d8e2dc", { rotation: -32, tintWeight: 0.85 }),
    txt("x-glyph", "x", { x: 0.34, y: 0.02, z: 0 }, { x: 0.24, y: 0.3 }, "#d8e2dc", { tintWeight: 0.9 }),
    first,
    inst("x-instance-2", 0.74, -0.02),
    inst("x-instance-3", 0.64, 0.26),
    remnant("#3d5a5e"),
  ];
  s.text = [];
}

// 6 — AM-IS: the personed copula — presence filled, the said outlined, the
// address leaning between.
{
  const s = scenes.get("AM-IS");
  s.field = { background: "#15130f", palette: ["#c98a6a", "#9ab4c9"], material: "ink", params: params({ speed: 0.5, turbulence: 0.16, dispersion: 0.07, contrast: 0.9 }) };
  s.view = view2d();
  const presence = base("am-presence", "the first-person presence", "disc", { x: -0.44, y: 0, z: 0 }, { x: 0.42, y: 0.42 }, "#c98a6a", { tintWeight: 0.9, share: 2 });
  seq(presence, [
    { objectState: os(0, { x: 0.42, y: 0.42 }, "#c98a6a", 0.9), hold: 3 },
    { objectState: os(0, { x: 0.45, y: 0.45 }, "#c98a6a", 0.9), hold: 3, transition: 1.3 },
    { objectState: os(0, { x: 0.42, y: 0.42 }, "#c98a6a", 0.9), hold: 3, transition: 1.3 },
  ]);
  s.entities = [
    presence,
    base("address-stroke", "the second person", "square", { x: 0, y: 0, z: 0 }, { x: 0.13, y: 0.72 }, P0, { rotation: 14, tintWeight: 0.9, share: 1.5 }),
    base("is-said", "the third-person said", "ring", { x: 0.44, y: 0, z: 0 }, { x: 0.42, y: 0.42 }, "#9ab4c9", { tintWeight: 0.75, share: 1.5 }),
    txt("am-glyph", "AM", { x: -0.44, y: -0.4, z: 0 }, { x: 0.2, y: 0.12 }, "#c98a6a"),
    txt("is-glyph", "IS", { x: 0.44, y: -0.4, z: 0 }, { x: 0.16, y: 0.12 }, "#9ab4c9"),
    remnant("#9ab4c9"),
  ];
  s.text = [];
}

// 7 — infinity-dx: the endless as two held circuits; differentials vanishing.
// Field held identical to AM-IS (still pair).
{
  const s = scenes.get("infinity-dx");
  s.field = JSON.parse(JSON.stringify(scenes.get("AM-IS").field));
  s.view = view2d();
  s.entities = [
    base("horizon-a", "the first lobe of the horizon", "ring", { x: -0.3, y: 0, z: 0 }, { x: 0.72, y: 0.72 }, "#9ab4c9", { tintWeight: 0.5, share: 1.5 }),
    base("horizon-b", "the second lobe of the horizon", "ring", { x: 0.3, y: 0, z: 0 }, { x: 0.72, y: 0.72 }, "#9ab4c9", { tintWeight: 0.5, share: 1.5 }),
    base("dx-a", "a differential", "disc", { x: 0.74, y: -0.3, z: 0 }, { x: 0.075, y: 0.075 }, P0, { tintWeight: 0.9, share: 0.6 }),
    base("dx-b", "a smaller differential", "disc", { x: 0.86, y: -0.42, z: 0 }, { x: 0.05, y: 0.05 }, P0, { tintWeight: 0.8, share: 0.5 }),
    base("dx-c", "the vanishing differential", "disc", { x: 0.95, y: -0.52, z: 0 }, { x: 0.032, y: 0.032 }, P0, { tintWeight: 0.7, share: 0.5 }),
    txt("dx-glyph", "dx", { x: -0.72, y: -0.44, z: 0 }, { x: 0.16, y: 0.1 }, "#9ab4c9"),
    remnant("#9ab4c9"),
  ];
  s.text = [];
}

// 8 — 1-0: the achieved mark returning into its condition.
{
  const s = scenes.get("1-0");
  s.field = { background: "#14161a", palette: ["#c9a25c", "#aeb6c2"], material: "ink", params: params({ speed: 0.6, turbulence: 0.2, dispersion: 0.09 }) };
  s.view = view2d(1.04);
  const mark = base("mark-disc", "the achieved mark", "disc", { x: -0.5, y: 0.1, z: 0 }, { x: 0.3, y: 0.3 }, "#c9a25c", { tintWeight: 0.9, share: 2 });
  seq(mark, [
    { position: { x: -0.5, y: 0.1, z: 0 }, hold: 3 },
    { position: { x: 0.34, y: 0, z: 0 }, hold: 3.2, transition: 1.3 },
  ]);
  s.entities = [
    base("ground-ring", "the condition", "ring", { x: 0.34, y: 0, z: 0 }, { x: 1.05, y: 1.05 }, "#aeb6c2", { tintWeight: 0.4, share: 1.2 }),
    mark,
    txt("one-glyph", "1", { x: -0.38, y: -0.55, z: 0 }, { x: 0.16, y: 0.24 }, P0),
    txt("slash-glyph", "/", { x: 0, y: -0.55, z: 0 }, { x: 0.1, y: 0.3 }, P0),
    txt("zero-glyph", "0", { x: 0.38, y: -0.55, z: 0 }, { x: 0.2, y: 0.26 }, P0),
    remnant("#aeb6c2"),
  ];
  s.text = [];
}

// 9 — head-mono-poly: the One at centre, the many circulating around it.
// Field held identical to 1-0 (still pair).
{
  const s = scenes.get("head-mono-poly");
  s.field = JSON.parse(JSON.stringify(scenes.get("1-0").field));
  s.view = view2d(1.04);
  const rimPositions = [];
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; rimPositions.push([Math.cos(a) * 0.6, Math.sin(a) * 0.6]); }
  s.entities = [
    base("held-whole", "the held whole", "ring", { x: 0, y: 0, z: 0 }, { x: 1.55, y: 1.55 }, "#aeb6c2", { tintWeight: 0.35, share: 1.5 }),
    base("one-centre", "the One at centre", "disc", { x: 0, y: 0, z: 0 }, { x: 0.2, y: 0.2 }, "#c9a25c", { tintWeight: 0.9, share: 2, force: force(0.25, "vortex", 0.1, 0.8) }),
    ...rimPositions.map(([x, y], i) => base(`many-${i + 1}`, "one of the many", "disc", { x, y, z: 0 }, { x: 0.085, y: 0.085 }, P0, { tintWeight: 0.7, share: 0.5 })),
    txt("one-glyph", "1", { x: 0, y: 0, z: 0 }, { x: 0.16, y: 0.2 }, "#14161a", { tintWeight: 0.9 }),
  ];
  s.text = [];
}

// 10 — head-complexio-oppositorum: the # drawn — four strokes crossing, every
// station of the relation held at the intersections.
{
  const s = scenes.get("head-complexio-oppositorum");
  s.field = { background: "#121316", palette: ["#e9e5d9", "#c9a25c", "#a89ec9", "#6a8c74"], material: "ink", params: params({ speed: 0.55, turbulence: 0.22, dispersion: 0.14, contrast: 0.9 }) };
  s.view = view2d();
  const strokeT = { tintWeight: 0.7, share: 1 };
  const station = (id, x, y, tint) => base(id, "a station of the relation", "disc", { x, y, z: 0 }, { x: 0.075, y: 0.075 }, tint, { tintWeight: 0.85, share: 0.6 });
  s.entities = [
    base("grid-v-a", "the first vertical of the sign", "square", { x: -0.28, y: 0, z: 0 }, { x: 0.09, y: 1.15 }, P0, strokeT),
    base("grid-v-b", "the second vertical of the sign", "square", { x: 0.28, y: 0, z: 0 }, { x: 0.09, y: 1.15 }, P0, strokeT),
    base("grid-h-a", "the first horizontal of the sign", "square", { x: 0, y: 0.18, z: 0 }, { x: 1.15, y: 0.09 }, P0, strokeT),
    base("grid-h-b", "the second horizontal of the sign", "square", { x: 0, y: -0.22, z: 0 }, { x: 1.15, y: 0.09 }, P0, strokeT),
    station("station-a", -0.28, 0.18, "#c9a25c"),
    station("station-b", 0.28, 0.18, "#a89ec9"),
    station("station-c", -0.28, -0.22, "#6a8c74"),
    station("station-d", 0.28, -0.22, "#d8e2dc"),
    txt("hash-glyph", "#", { x: 0, y: -0.02, z: 0 }, { x: 0.12, y: 0.16 }, P0, { tintWeight: 0.9 }),
    remnant("#c9a25c"),
  ];
  s.text = [];
}

// 11 — head-self-identity: two appearances and the identifying relation;
// sameness available through difference (the second appearance warms and
// returns). Field held identical to complexio (still pair).
{
  const s = scenes.get("head-self-identity");
  s.field = JSON.parse(JSON.stringify(scenes.get("head-complexio-oppositorum").field));
  s.view = view2d();
  const second = base("appear-b", "the second appearance", "disc", { x: 0.42, y: 0, z: 0 }, { x: 0.3, y: 0.3 }, P0, { tintWeight: 0.85, share: 1.5 });
  seq(second, [
    { objectState: os(0, { x: 0.3, y: 0.3 }, P0, 0.85), hold: 3 },
    { objectState: os(0, { x: 0.3, y: 0.3 }, "#d8c49a", 0.85), hold: 2.5, transition: 1.2 },
    { objectState: os(0, { x: 0.3, y: 0.3 }, P0, 0.85), hold: 3, transition: 1.2 },
  ]);
  s.entities = [
    base("appear-a", "the first appearance", "disc", { x: -0.42, y: 0, z: 0 }, { x: 0.3, y: 0.3 }, P0, { tintWeight: 0.85, share: 1.5 }),
    second,
    base("eq-a", "the first bar of the relation", "square", { x: 0, y: 0.07, z: 0 }, { x: 0.34, y: 0.055 }, "#c9a25c", { tintWeight: 0.8 }),
    base("eq-b", "the second bar of the relation", "square", { x: 0, y: -0.07, z: 0 }, { x: 0.34, y: 0.055 }, "#c9a25c", { tintWeight: 0.8 }),
    txt("a-glyph-first", "A", { x: -0.42, y: -0.44, z: 0 }, { x: 0.14, y: 0.18 }, P0),
    txt("a-glyph-second", "A", { x: 0.42, y: -0.44, z: 0 }, { x: 0.14, y: 0.18 }, P0),
    remnant("#c9a25c"),
  ];
  s.text = [];
}

// 12 — head-subject-logics: the Ø traversal run — the subject-mark travels the
// drawn path from the unobjectifiable 0-pole through the occlusions to 1.
{
  const s = scenes.get("head-subject-logics");
  s.field = { background: "#0f1116", palette: ["#aeb6c2", "#c9a25c", "#a89ec9", "#c98a6a"], material: "ink", params: params({ speed: 0.75, turbulence: 0.24, dispersion: 0.12 }) };
  s.view = view2d();
  const stops = [-1.02, -0.66, -0.31, 0.04, 0.48, 1.04, 1.4];
  const run = base("traversal-disc", "the subject-mark traversing", "disc", { x: -1.02, y: 0, z: 0 }, { x: 0.14, y: 0.14 }, "#c9a25c", { tintWeight: 0.9, share: 2 });
  seq(run, stops.map((x, i) => ({ position: { x, y: 0, z: 0 }, hold: i === 0 || i === stops.length - 1 ? 2 : 1.4, transition: 0.7 })));
  const chain = (id, text, x, size) => txt(id, text, { x, y: -0.34, z: 0 }, size, "#aeb6c2", { tintWeight: 0.8 });
  s.entities = [
    base("traversal-path", "the path of the traversal", "square", { x: 0.19, y: 0, z: 0 }, { x: 2.7, y: 0.045 }, "#aeb6c2", { tintWeight: 0.3 }),
    base("subject-ring", "the unobjectifiable", "ring", { x: -1.02, y: 0, z: 0 }, { x: 0.3, y: 0.3 }, "#aeb6c2", { tintWeight: 0.6 }),
    run,
    chain("occlusion-glyph", "Ø", -0.66, { x: 0.16, y: 0.18 }),
    chain("capacity-glyph", "X", -0.31, { x: 0.14, y: 0.18 }),
    chain("ratio-glyph", "Ø/X", 0.04, { x: 0.26, y: 0.11 }),
    chain("selfratio-glyph", "(0/Ø)", 0.48, { x: 0.3, y: 0.1 }),
    chain("traversal-glyph", "(1/X)", 1.04, { x: 0.3, y: 0.1 }),
    chain("one-glyph", "1", 1.4, { x: 0.11, y: 0.14 }),
    remnant("#c9a25c"),
  ];
  s.text = [];
}

// 13 — spine-index: the envelope of the whole in 3d — centre orientation, four
// cardinal stations, the thresholds bracketing on the rim.
{
  const s = scenes.get("spine-index");
  s.field = { background: "#0b0d11", palette: ["#e9e5d9", "#c9a25c", "#aeb6c2"], material: "ink", params: params({ speed: 0.45, turbulence: 0.15, dispersion: 0.08, contrast: 0.9 }) };
  s.view = { mode: "3d", yaw: 0.55, pitch: 0.22, zoom: 0.95, panX: 0, panY: 0 };
  s.entities = [
    base("envelope-whole", "the envelope of the whole", "ring", { x: 0, y: 0, z: -0.1 }, { x: 1.9, y: 1.9 }, P0, { tintWeight: 0.4, share: 2 }),
    txt("orientation-glyph", "0/1", { x: 0, y: 0, z: 0.5 }, { x: 0.34, y: 0.4 }, "#c9a25c", { tintWeight: 0.9 }),
    txt("qa-glyph", "?/!", { x: 0, y: 0.44, z: 0 }, { x: 0.26, y: 0.12 }, P0),
    txt("mp-glyph", "−/+", { x: 0.46, y: 0, z: 0 }, { x: 0.26, y: 0.12 }, P0),
    txt("xx-glyph", "X/x", { x: 0, y: -0.44, z: 0 }, { x: 0.24, y: 0.12 }, P0),
    txt("amis-glyph", "AM/IS", { x: -0.46, y: 0, z: 0 }, { x: 0.3, y: 0.12 }, P0),
    txt("parent-glyph", "−/−", { x: 0, y: 0.96, z: -0.35 }, { x: 0.34, y: 0.14 }, "#aeb6c2", { tintWeight: 0.7 }),
    txt("horizon-glyph", "∞/dx", { x: -0.68, y: -0.68, z: -0.5 }, { x: 0.4, y: 0.14 }, "#aeb6c2", { tintWeight: 0.7 }),
    txt("return-glyph", "1/0", { x: 0.68, y: -0.68, z: -0.6 }, { x: 0.34, y: 0.14 }, "#aeb6c2", { tintWeight: 0.7 }),
  ];
  s.text = [];
}

// engine key normalised away everywhere (defaults are the engine's business)
for (const s of j.scenes) delete s.engine;

// ---- binding: rationales from actual usage ----------------------------------
const used = new Set();
const isText = (e) => e.shape === "text" || (!e.shape && e.text);
for (const s of j.scenes) for (const e of s.entities ?? []) {
  const g = (e.text ?? "").trim();
  if (g) used.add(g); else if (e.kind === "formation" && e.name) used.add(e.name);
  if (e.sequence?.enabled) for (const st of e.sequence.steps ?? []) { const sg = (st.text ?? "").trim(); if (sg) used.add(sg); }
}

const NEW_RATIONALES = {
  "whole-remnant": "the whole retained as a small faint ring in every determination — containment drawn, per the record's own traversal law",
  "the unmarked field": "the field within which relation precedes its terms — the slash drawn before anything is named",
  "the first placement": "a dash placed once, value and name withheld — the − of −/− before terms",
  "the stroke": "the stroke itself leaning: / as drawn relation between placements, not written mark",
  "the second placement": "the same dash placed again — relation, not repetition of a value",
  "the polyvalent All": "the All: the whole through which the One becomes articulate (1 = All)",
  "the singular One": "the One: the ground-point that articulates without multiplying (0 = One)",
  "the many held": "the All as held plurality — the many the One traverses",
  "the corner of assertion": "the catuskoti's first corner: the posture of saying IS",
  "the corner of negation": "the second corner: IS-NOT — the posture of denial",
  "the corner of both": "the third corner: BOTH held without cancelling either",
  "the corner of neither": "the fourth corner: NEITHER — refusal of the pair as posed",
  "the silence beneath": "SILENCE drawn as ground: the depth under all four postures, not a fifth word",
  "the breathing field": "the field that breathes: reserve and issue as one circulation",
  "the reserve": "negation's self-relation: the withdrawal that makes affirmation available",
  "the issue": "the appearing face issued from the reserve — extension, affirmation",
  "the first stroke of capacity": "half of the X drawn: determining capacity as a crossing of strokes",
  "the second stroke of capacity": "the other half: capacity exists only as crossed",
  "an instance arising": "a particular arising from capacity and dissolving back — x from X",
  "the first-person presence": "AM: presence filled and warm, first-person, prior to predication",
  "the second person": "the slash as address: the leaning stroke between speaker and said",
  "the third-person said": "IS: the sayable, outlined — available for predication, never possessed",
  "the first lobe of the horizon": "one circuit of the endless — ∞ drawn as two held circulations",
  "the second lobe of the horizon": "the second circuit: the endless held as circulation, not line",
  "a differential": "dx: the local difference through which change becomes exact",
  "a smaller differential": "the differential diminishing toward its vanishing measure",
  "the vanishing differential": "the differential at its limit — exact because it vanishes",
  "the condition": "the ground to which the achieved mark returns — the 0-pole of 1/0",
  "the achieved mark": "the mark that returns: articulation bracketed back to its condition",
  "the held whole": "the whole holding One-through-many without absorbing the many",
  "the One at centre": "the One the many circulate: mono through poly, a vortex not a monarch",
  "one of the many": "one of the mutually implicate accountings held around the One",
  "the first vertical of the sign": "the # drawn: one stroke of the whole determining relation",
  "the second vertical of the sign": "the second stroke: the relation repeated through stations",
  "the first horizontal of the sign": "the cross-stroke binding the verticals — the complexio holding",
  "the second horizontal of the sign": "the second binding: opposites held, not merged",
  "a station of the relation": "one crossing where the determining relation is followed through",
  "the first appearance": "an A appearing: identity requires two appearances and a relation",
  "the second appearance": "the same appearing again: sameness available only through difference",
  "the first bar of the relation": "the equals drawn: one bar of the identifying relation",
  "the second bar of the relation": "the second bar: = as two held bars, not a name",
  "the path of the traversal": "the drawn path the subject-mark runs: 0 to 1 through the occlusions",
  "the unobjectifiable": "the 0-pole drawn as empty ring: it bounds the account but never appears in it",
  "the subject-mark traversing": "the traversal itself: the mark passing through Ø, X and their ratios to 1",
  "the envelope of the whole": "the mandala-envelope holding the eight determinations and their stations",
  "a cardinal station": "one of the four cardinal stations of the held traversal",
  "?": "inquiry as a sign: openness to determination, before any assertion",
  "!": "assertion as a sign: the act of asserting enough for a determination to stand",
  "#": "the native sign of the whole determining relation followed through every station",
};
for (const [g, r] of Object.entries(NEW_RATIONALES)) b.glyph_rationales[g] = r;
const pruned = [];
for (const g of Object.keys(b.glyph_rationales)) if (!used.has(g)) { delete b.glyph_rationales[g]; pruned.push(g); }

b.recraft = {
  date: "2026-10-07",
  actor: "zcode:craft-lane-3",
  lane: "enrich/expressions-craft-20261007",
  read_revision: "fc59a719c75ddddb821afc7bb0ac0e66116c12a1",
  note: "rework pass: editorial panels removed from the stage entirely (the records' words live in the binding; scene characters carry the reading); every determination now drawn — the slash as a leaning stroke between two placements, 0/1 as the One articulating through the polyvalent All, ?/! as catuskoti corners flashing their words over drawn silence, −/+ as a breathing reserve-and-issue, X/x as crossed strokes with instances arising, AM/IS as filled presence / leaning address / outlined said, ∞/dx as twin circuits with differentials vanishing, 1/0 as the mark returning into its condition, Mono/Poly as a vortex of many around One, # as a four-stroke grid with its stations, A=A as twin appearances warming through the relation, the Ø traversal as a mark running a drawn path, and the envelope closing in 3d; colour travels — cold origin, gold dawn, breathing teal, personed warmth, return silver, four-accent gathering, traversal spectrum, night envelope; five of twelve adjacent pairs hold their ground unchanged.",
};
b.status = "reviewed";

writeFileSync(JP, JSON.stringify(j, null, 1) + "\n");
writeFileSync(BP, JSON.stringify(b, null, 1) + "\n");
const forms = j.scenes.reduce((a, s) => a + (s.entities ?? []).filter((e) => e.kind === "formation").length, 0);
const nonText = j.scenes.reduce((a, s) => a + (s.entities ?? []).filter((e) => e.kind === "formation" && !isText(e)).length, 0);
console.log("spine re-crafted. formations:", forms, "non-text:", nonText, `(${Math.round((100 * nonText) / forms)}%)`,
  "| pruned rationales:", pruned.length ? pruned.join(", ") : "none", "| rationales:", Object.keys(b.glyph_rationales).length);
