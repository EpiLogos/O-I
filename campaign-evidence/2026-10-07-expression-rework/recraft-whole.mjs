// Craft lane 3 — symbolon whole re-craft. The whole is parā: one envelope
// holding Matheme, Mytheme and Episteme as distinct presences without fusion.
// The prior pass staged an editorial panel per scene and quoted the matheme's
// compression as one long sentence-glyph; this re-craft performs the
// derivation as time (notation cycling through its steps), holds the three
// registers under one gathered ground (each presence its own tint and figure),
// replaces the yantra step with a gathering ring, and closes by returning the
// obverse to the root's own ground. Two of five adjacent pairs hold.
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_PARAMS } from "../../packages/oi-design-system/expressions-engine/shell/model.mjs";

const JP = "desktop/cradle/expressions-app/collections/return-of-zero/symbolon/roz-symbolon-whole.journey.json";
const BP = "desktop/cradle/expressions-app/collections/return-of-zero/symbolon/bindings/roz-symbolon-whole.binding.json";

const j = JSON.parse(readFileSync(JP, "utf8"));
const b = JSON.parse(readFileSync(BP, "utf8"));

const params = (over = {}) => ({ ...DEFAULT_PARAMS, speed: 0.5, turbulence: 0.18, dispersion: 0.07, contrast: 0.92, ...over });
const force = () => ({ kind: "attract", strength: 0, radius: 0.45, spin: 0 });
const base = (id, name, shape, position, size, tint, extra = {}) => ({
  id, name, kind: "formation", position, size, rotation: 0, shape, text: "",
  share: 1, tint, tintWeight: 0.8, locked: false, force: force(), station: null,
  sequence: { enabled: false, clock: "seconds", steps: [{ id: id + "-st0", text: "", shape, hold: 3, transition: 1, position: null }] },
  ...extra,
});
const seq = (e, steps) => {
  e.sequence = { enabled: true, clock: "seconds", order: "loop", easing: "smoothstep", steps: steps.map((s, i) => ({ id: `${e.id}-st${i}`, text: s.text ?? "", shape: s.shape ?? e.shape, hold: s.hold ?? 2.8, transition: s.transition ?? 1, position: s.position ?? null, ...(s.objectState ? { objectState: s.objectState } : {}) })) };
  return e;
};
const txt = (id, text, position, size, tint, extra = {}) => ({
  id, name: id, kind: "formation", position, size, rotation: 0, shape: "text", text,
  share: 1, tint, tintWeight: 0.85, locked: false, force: force(), station: null,
  sequence: { enabled: false, clock: "seconds", steps: [{ id: id + "-st0", text, shape: "text", hold: 3, transition: 1, position: null }] },
  ...extra,
});
const envelope = (tw = 0.4, share = 2) => base("whole-envelope", "whole-envelope", "ring", { x: 0, y: 0, z: 0 }, { x: 1.9, y: 1.9 }, "#e9e5d9", { tintWeight: tw, share });
const view2d = (zoom = 1) => ({ mode: "2d", yaw: 0, pitch: 0, zoom, panX: 0, panY: 0 });

const scenes = new Map(j.scenes.map((s) => [s.id, s]));
const P0 = "#e9e5d9";

// 1 — whole-root: the envelope, the root relation turning at centre, the
// obverse waiting at the rim.
{
  const s = scenes.get("whole-root");
  s.field = { background: "#14161a", palette: ["#e9e5d9", "#c9a25c"], material: "ink", params: params() };
  s.view = view2d();
  const root = txt("root-glyph", "0/1", { x: 0, y: 0, z: 0 }, { x: 0.72, y: 0.85 }, P0, { tintWeight: 0.95, share: 2 });
  seq(root, [
    { text: "0/1", hold: 3.2 },
    { text: "1/0", hold: 3 },
    { text: "0/1", hold: 3.2 },
  ]);
  s.entities = [
    envelope(),
    base("root-ground", "the ground of the root", "disc", { x: 0, y: 0, z: 0 }, { x: 0.62, y: 0.62 }, "#c9a25c", { tintWeight: 0.3, share: 1.2 }),
    root,
    txt("rim-glyph", "1/0", { x: 0, y: -0.96, z: 0 }, { x: 0.4, y: 0.14 }, "#c9a25c", { tintWeight: 0.7 }),
  ];
  s.text = [];
}

// 2 — held-matheme: the operative logic held cool and exact — the derivation
// performing as time on the exact lattice.
{
  const s = scenes.get("held-matheme");
  s.field = { background: "#12151a", palette: ["#e9e5d9", "#8b98a8"], material: "ink", params: params({ speed: 0.45, dispersion: 0.06 }) };
  s.view = view2d(1.02);
  const derivation = txt("derivation-glyph", "0/1", { x: 0, y: 0.02, z: 0 }, { x: 0.5, y: 0.6 }, "#e8f0f4", { tintWeight: 0.9, share: 1.8 });
  seq(derivation, [
    { text: "0/1", hold: 2.6 },
    { text: "4+2", hold: 2.4 },
    { text: "5→0", hold: 2.4 },
    { text: "1/0", hold: 2.6 },
    { text: "0/1", hold: 2.6 },
  ]);
  s.entities = [
    envelope(0.35),
    base("matheme-lattice", "the exact lattice", "square", { x: 0, y: 0.02, z: 0 }, { x: 0.9, y: 0.9 }, "#6fa8c9", { tintWeight: 0.3, share: 1.2 }),
    derivation,
  ];
  s.text = [];
}

// 3 — held-mytheme: the formed image held warm and patterned. The yantra step
// is gone: the pattern gathers to a rim and returns. Ground held (still pair).
{
  const s = scenes.get("held-mytheme");
  s.field = JSON.parse(JSON.stringify(scenes.get("held-matheme").field));
  s.view = view2d(1.02);
  const presence = base("mytheme-presence", "mytheme-presence", "cymatic", { x: 0, y: 0.02, z: 0 }, { x: 0.85, y: 0.85 }, "#c98a6a", { tintWeight: 0.8, share: 1.5 });
  seq(presence, [
    { hold: 3 },
    { shape: "ring", hold: 2.4, transition: 1.2 },
    { hold: 3, transition: 1.2 },
  ]);
  s.entities = [envelope(0.35), presence];
  s.text = [];
}

// 4 — held-episteme: the instituted lattice, quiet and checkable — the frame
// and the turned square of verification inside it. Ground held (still pair).
{
  const s = scenes.get("held-episteme");
  s.field = JSON.parse(JSON.stringify(scenes.get("held-matheme").field));
  s.view = view2d(1.02);
  s.entities = [
    envelope(0.35),
    base("episteme-presence", "episteme-presence", "square", { x: 0, y: 0.02, z: 0 }, { x: 0.82, y: 0.82 }, "#6a8c74", { tintWeight: 0.7, share: 1.3 }),
    base("episteme-check", "the check within", "square", { x: 0, y: 0.02, z: 0 }, { x: 0.4, y: 0.4 }, "#e2e8e0", { rotation: 45, tintWeight: 0.7, share: 1 }),
  ];
  s.text = [];
}

// 5 — whole-held: three presences, one whole, no fusion — matheme above as
// notation, mytheme below-left, episteme below-right, the slash between.
{
  const s = scenes.get("whole-held");
  s.field = { background: "#0b0d11", palette: ["#e9e5d9", "#c9a25c", "#6fa8c9", "#c98a6a"], material: "ink", params: params({ turbulence: 0.2 }) };
  s.view = { mode: "3d", yaw: 0.45, pitch: 0.2, zoom: 1, panX: 0, panY: 0 };
  const slash = txt("held-slash", "/", { x: 0, y: 0, z: 0 }, { x: 0.16, y: 0.5 }, P0, { tintWeight: 0.9, share: 1.5 });
  s.entities = [
    envelope(0.4, 2),
    txt("held-root", "0/1", { x: 0, y: 0.58, z: -0.55 }, { x: 0.34, y: 0.14 }, P0),
    slash,
    base("mytheme-presence", "mytheme-presence", "cymatic", { x: -0.5, y: -0.3, z: 0 }, { x: 0.38, y: 0.38 }, "#c98a6a", { tintWeight: 0.8, share: 1 }),
    base("episteme-presence", "episteme-presence", "square", { x: 0.5, y: -0.3, z: 0.55 }, { x: 0.36, y: 0.36 }, "#6a8c74", { tintWeight: 0.75, share: 1 }),
  ];
  s.text = [];
}

// 6 — whole-return: the orientation reverses — the return at centre, the first
// orientation at the rim — back on the root's own ground.
{
  const s = scenes.get("whole-return");
  s.field = { background: "#14161a", palette: ["#e9e5d9", "#c9a25c"], material: "ink", params: params() };
  s.view = view2d();
  const obverse = txt("obverse-glyph", "1/0", { x: 0, y: 0, z: 0 }, { x: 0.72, y: 0.85 }, P0, { tintWeight: 0.95, share: 2 });
  seq(obverse, [
    { text: "1/0", hold: 3.2 },
    { text: "0/1", hold: 3 },
    { text: "1/0", hold: 3.2 },
  ]);
  s.entities = [
    envelope(),
    base("root-ground", "the ground of the root", "disc", { x: 0, y: 0, z: 0 }, { x: 0.62, y: 0.62 }, "#c9a25c", { tintWeight: 0.3, share: 1.2 }),
    obverse,
    txt("rim-glyph", "0/1", { x: 0, y: 0.96, z: 0 }, { x: 0.4, y: 0.14 }, "#c9a25c", { tintWeight: 0.7 }),
  ];
  s.text = [];
}

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
  "whole-envelope": "the whole form drawn as one envelope — Symbolon as parā, holding its registers without fusing them",
  "the ground of the root": "the still centre against which the root relation reads — the whole's own depth",
  "the exact lattice": "the matheme's square: exact, repeatable structure — cool and checkable",
  "mytheme-presence": "the formed image's presence: myth as patterned sound made visible — a cymatic field",
  "episteme-presence": "the instituted lattice's presence: the frame of checkable houses",
  "the check within": "inspection inside the instituted frame — the turned square of verification",
};
for (const [g, r] of Object.entries(NEW_RATIONALES)) b.glyph_rationales[g] = r;
const pruned = [];
for (const g of Object.keys(b.glyph_rationales)) if (!used.has(g)) { delete b.glyph_rationales[g]; pruned.push(g); }

b.recraft = {
  date: "2026-10-07",
  actor: "zcode:craft-lane-3",
  lane: "enrich/expressions-craft-20261007",
  read_revision: "fc59a719c75ddddb821afc7bb0ac0e66116c12a1",
  note: "rework pass: editorial panels removed from the stage (the record's words live here; scene characters carry the reading); the matheme's compression no longer sits as one sentence-glyph — it performs as time, the notation cycling 0/1 → 4+2 → 5→0 → 1/0 on the exact lattice; the yantra step in the mytheme presence is replaced by the pattern gathering to a rim; the episteme presence gains its turned square of verification; the three registers are held under one gathered ground, each its own tint and figure, and the whole-held stages them unfused in 3d; the return lands the obverse back on the root's ground; two of five adjacent pairs hold their ground unchanged.",
};
b.status = "reviewed";

writeFileSync(JP, JSON.stringify(j, null, 1) + "\n");
writeFileSync(BP, JSON.stringify(b, null, 1) + "\n");
const forms = j.scenes.reduce((a, s) => a + (s.entities ?? []).filter((e) => e.kind === "formation").length, 0);
const nonText = j.scenes.reduce((a, s) => a + (s.entities ?? []).filter((e) => e.kind === "formation" && !isText(e)).length, 0);
console.log("whole re-crafted. formations:", forms, "non-text:", nonText, `(${Math.round((100 * nonText) / forms)}%)`,
  "| pruned:", pruned.length ? pruned.join(", ") : "none", "| rationales:", Object.keys(b.glyph_rationales).length);
