// Craft lane 3 — conjugates re-draw: the seven scenes that carried the other
// face's figure get their own. Identity fields untouched; entities only.
import { readFileSync, writeFileSync } from "node:fs";

const JP = "desktop/cradle/expressions-app/collections/return-of-zero/conjugates/roz-a-prime-conjugates.journey.json";
const BP = "desktop/cradle/expressions-app/collections/return-of-zero/conjugates/bindings/roz-a-prime-conjugates.binding.json";

const j = JSON.parse(readFileSync(JP, "utf8"));
const b = JSON.parse(readFileSync(BP, "utf8"));

const force = (strength = 0, kind = "attract", spin = 0) => ({ kind, strength, radius: 0.45, spin });
const base = (id, name, shape, position, size, tint, extra = {}) => ({
  id, name, kind: "formation", position, size, rotation: 0, shape, text: "",
  share: 1, tint, tintWeight: 0.8, locked: false, force: force(), station: null,
  sequence: { enabled: false, clock: "seconds", steps: [{ id: id + "-st0", text: "", shape, hold: 3, transition: 1, position: null }] },
  ...extra
});
const seq = (e, steps, order = "loop", easing = "smoothstep") => {
  e.sequence = { enabled: true, clock: "seconds", order, easing, steps: steps.map((s, i) => ({ id: `${e.id}-st${i}`, text: s.text ?? "", shape: s.shape ?? e.shape, hold: s.hold ?? 2.6, transition: s.transition ?? 1, position: s.position ?? null, ...(s.objectState ? { objectState: s.objectState } : {}) })) };
  return e;
};
const os = (rotation, size, tint, tintWeight, spin = 0, strength = 0) => ({ size, rotation, tint, tintWeight, force: { kind: strength ? "vortex" : "attract", strength, radius: 0.45, spin } });

const scenes = new Map(j.scenes.map((s) => [s.id, s]));

// ---- a04p — The Mask as Document -------------------------------------------
// The glove: a presentation so fitted to a prepared expectation that its fit
// documents the hand. Drawn: the mould, the mask settling into its fit (read
// diaphanously through to what it documents).
{
  const s = scenes.get("a04p");
  const hand = base("a04p-hand", "the expectation it is fitted to", "square", { x: 0.12, y: 0.02, z: 0 }, { x: 0.6, y: 0.6 }, "#7e94a4", { tintWeight: 0.3, share: 1 });
  const mask = base("a04p-mask", "the worn presentation", "square", { x: -0.12, y: -0.02, z: 0 }, { x: 0.95, y: 0.95 }, "#2c3540", { rotation: 7, tintWeight: 0.8, share: 1.5 });
  seq(mask, [
    { objectState: os(0, { x: 1.0, y: 1.0 }, "#7e94a4", 0.3), hold: 3 },
    { objectState: os(7, { x: 0.95, y: 0.95 }, "#2c3540", 0.8), hold: 3.2 },
  ]);
  const read = base("a04p-read", "the read-through", "ring", { x: -0.12, y: -0.02, z: 0 }, { x: 1.3, y: 1.3 }, "#7e94a4", { tintWeight: 0.25, share: 0.8 });
  s.entities = [hand, mask, read];
}

// ---- a05p — Lights, Camera, Action ------------------------------------------
// Light (appearing), camera-work (registration/retention — the frame drawing
// in), action (the consequence), and the evaluator's cut: a result outside the
// frame dimming out of consideration.
{
  const s = scenes.get("a05p");
  const light = base("a05p-light", "the light — appearing", "disc", { x: -0.55, y: 0.3, z: 0 }, { x: 0.4, y: 0.4 }, "#7e94a4", { tintWeight: 0.35, share: 1.5 });
  const frame = base("a05p-frame", "the frame — camera-work", "square", { x: 0.05, y: 0, z: 0 }, { x: 1.05, y: 0.8 }, "#2c3540", { tintWeight: 0.75, share: 1.5 });
  seq(frame, [
    { objectState: os(0, { x: 1.05, y: 0.8 }, "#2c3540", 0.75), hold: 2.8 },
    { objectState: os(0, { x: 0.92, y: 0.7 }, "#2c3540", 0.85), hold: 2.8 },
  ]);
  const action = base("a05p-action", "the action — consequence", "triangle", { x: 0.62, y: -0.4, z: 0 }, { x: 0.34, y: 0.34 }, "#2c3540", { tintWeight: 0.85, share: 1 });
  const cut = base("a05p-cut", "what the frame cuts out", "disc", { x: 0.68, y: 0.42, z: 0 }, { x: 0.14, y: 0.14 }, "#7e94a4", { tintWeight: 0.3, share: 0.6 });
  s.entities = [light, frame, action, cut];
}

// ---- a10p — The Uncounted Enters the Account --------------------------------
// The crossover ratio acting: a field of fast counted units inside the
// account-circle, and the slower uncounted layer crossing its boundary into an
// explicit office.
{
  const s = scenes.get("a10p");
  const account = base("a10p-account", "the account acted through", "ring", { x: 0.05, y: 0, z: 0 }, { x: 1.25, y: 1.25 }, "#6fa8c9", { tintWeight: 0.45, share: 1.4 });
  const c1 = base("a10p-counted-1", "the counted throughput", "disc", { x: -0.28, y: 0.18, z: 0 }, { x: 0.075, y: 0.075 }, "#e8f0f4", { tintWeight: 0.8, share: 0.5 });
  const c2 = base("a10p-counted-2", "the counted throughput", "disc", { x: -0.05, y: -0.2, z: 0 }, { x: 0.075, y: 0.075 }, "#e8f0f4", { tintWeight: 0.8, share: 0.5 });
  const c3 = base("a10p-counted-3", "the counted throughput", "disc", { x: 0.22, y: 0.12, z: 0 }, { x: 0.075, y: 0.075 }, "#e8f0f4", { tintWeight: 0.8, share: 0.5 });
  const unc = base("a10p-uncounted", "the uncounted, slower layer", "disc", { x: 0.95, y: 0.28, z: 0 }, { x: 0.19, y: 0.19 }, "#6fa8c9", { tintWeight: 0.8, share: 1.6 });
  seq(unc, [
    { position: { x: 0.95, y: 0.28, z: 0 }, hold: 3 },
    { position: { x: 0.05, y: 0, z: 0 }, hold: 3.2, transition: 1.4 },
  ]);
  s.entities = [account, c1, c2, c3, unc];
}

// ---- a18p — The Traversal Run in Code ---------------------------------------
// A request joins person, concern and world and becomes executable: the
// prompt (the executable threshold), the run's crossing, the request
// traversing from entry to issued result.
{
  const s = scenes.get("a18p");
  const prompt = base("a18p-prompt", "the prompt — the executable threshold", "disc", { x: -0.62, y: 0.34, z: 0 }, { x: 0.72, y: 0.4 }, "#e4eae6", { tintWeight: 0.9, share: 1.6 });
  prompt.source = { kind: "ascii", ascii: { text: "> _" } };
  const threshold = base("a18p-threshold", "the run's threshold", "ring", { x: 0, y: 0, z: 0 }, { x: 0.95, y: 0.95 }, "#9ab4ac", { tintWeight: 0.4, share: 1.3 });
  const request = base("a18p-request", "the request traversing", "disc", { x: -0.62, y: 0.34, z: 0 }, { x: 0.16, y: 0.16 }, "#e4eae6", { tintWeight: 0.85, share: 2 });
  seq(request, [
    { position: { x: -0.62, y: 0.34, z: 0 }, objectState: os(0, { x: 0.16, y: 0.16 }, "#e4eae6", 0.85), hold: 2.2 },
    { position: { x: 0, y: 0, z: 0 }, objectState: os(0, { x: 0.16, y: 0.16 }, "#cfe0d6", 0.85), hold: 1.6, transition: 0.8 },
    { position: { x: 0.62, y: -0.34, z: 0 }, objectState: os(0, { x: 0.16, y: 0.16 }, "#9ab4ac", 0.9), hold: 2.2, transition: 0.8 },
  ]);
  s.entities = [prompt, threshold, request];
}

// ---- a26p — The Essay Inside the Film ---------------------------------------
// The lens takes itself as object: the film (the world of mediation), the
// essay made off-centre within it (never from nowhere), and the lens moving
// from the world to its own making.
{
  const s = scenes.get("a26p");
  const film = base("a26p-film", "the film — the world of mediation", "square", { x: 0, y: 0, z: 0 }, { x: 1.75, y: 1.35 }, "#5c7078", { tintWeight: 0.25, share: 1.2 });
  const essay = base("a26p-essay", "the essay being made", "square", { x: -0.18, y: -0.08, z: 0 }, { x: 0.62, y: 0.48 }, "#28323a", { rotation: -4, tintWeight: 0.8, share: 1.5 });
  const lens = base("a26p-lens", "the lens taking itself as object", "ring", { x: 0.6, y: 0.42, z: 0 }, { x: 0.34, y: 0.34 }, "#28323a", { tintWeight: 0.85, share: 1.5 });
  seq(lens, [
    { position: { x: 0.6, y: 0.42, z: 0 }, hold: 2.8 },
    { position: { x: -0.18, y: -0.08, z: 0 }, hold: 3, transition: 1.2 },
  ]);
  s.entities = [film, essay, lens];
}

// ---- a31p — Deference as Co-Evolutionary Alignment --------------------------
// Alignment located in contact: two differently paced figures drifting toward
// each other's colour through a contact that widens as adoption refactors.
{
  const s = scenes.get("a31p");
  const human = base("a31p-human", "the human institution", "disc", { x: -0.5, y: 0, z: 0 }, { x: 0.4, y: 0.4 }, "#dae2dc", { tintWeight: 0.8, share: 1.5 });
  seq(human, [
    { objectState: os(0, { x: 0.4, y: 0.4 }, "#dae2dc", 0.8), hold: 3 },
    { objectState: os(0, { x: 0.4, y: 0.4 }, "#b4c4ba", 0.8), hold: 2.5, transition: 1.3 },
    { objectState: os(0, { x: 0.4, y: 0.4 }, "#dae2dc", 0.8), hold: 3, transition: 1.3 },
  ]);
  const machine = base("a31p-machine", "the machine population", "disc", { x: 0.5, y: 0, z: 0 }, { x: 0.26, y: 0.26 }, "#8aa898", { tintWeight: 0.85, share: 1.5 });
  seq(machine, [
    { objectState: os(0, { x: 0.26, y: 0.26 }, "#8aa898", 0.85), hold: 3 },
    { objectState: os(0, { x: 0.3, y: 0.3 }, "#b0c2b6", 0.85), hold: 2.5, transition: 1.3 },
    { objectState: os(0, { x: 0.26, y: 0.26 }, "#8aa898", 0.85), hold: 3, transition: 1.3 },
  ]);
  const contact = base("a31p-contact", "the contact where alignment happens", "ring", { x: 0, y: 0, z: 0 }, { x: 0.3, y: 0.3 }, "#dae2dc", { tintWeight: 0.4, share: 1 });
  seq(contact, [
    { objectState: os(0, { x: 0.3, y: 0.3 }, "#dae2dc", 0.4), hold: 2.8 },
    { objectState: os(0, { x: 0.38, y: 0.38 }, "#dae2dc", 0.4), hold: 2.8, transition: 1.2 },
  ]);
  s.entities = [human, machine, contact];
}

// ---- a34p — The Direction of Dependence -------------------------------------
// A forecast can affect the event it forecasts: the intervention forms at the
// forecast and acts on the event; the event's conditioning changes.
{
  const s = scenes.get("a34p");
  const field = base("a34p-field", "the reflexive field", "square", { x: 0, y: 0, z: 0 }, { x: 1.9, y: 1.3 }, "#6c7e94", { tintWeight: 0.15, share: 1 });
  const forecast = base("a34p-forecast", "the forecast", "disc", { x: -0.55, y: 0.3, z: 0 }, { x: 0.28, y: 0.28 }, "#262e38", { tintWeight: 0.8, share: 1.5 });
  const intervention = base("a34p-intervention", "the intervention", "ring", { x: -0.35, y: 0.2, z: 0 }, { x: 0.24, y: 0.24 }, "#6c7e94", { tintWeight: 0.8, share: 1.5 });
  seq(intervention, [
    { position: { x: -0.35, y: 0.2, z: 0 }, hold: 2.6 },
    { position: { x: 0.4, y: -0.25, z: 0 }, hold: 2.6, transition: 1.1 },
  ]);
  const event = base("a34p-event", "the event re-conditioned", "disc", { x: 0.55, y: -0.3, z: 0 }, { x: 0.28, y: 0.28 }, "#262e38", { tintWeight: 0.7, share: 1.5 });
  seq(event, [
    { objectState: os(0, { x: 0.28, y: 0.28 }, "#262e38", 0.7), hold: 2.5 },
    { objectState: os(0, { x: 0.28, y: 0.28 }, "#4a5c70", 0.7), hold: 2.5, transition: 1.2 },
  ]);
  s.entities = [field, forecast, intervention, event];
}

// ---- small craft fixes ------------------------------------------------------
{
  const s = scenes.get("a12p");
  const discs = s.entities.filter((e) => e.id.startsWith("a12p-") && e.shape === "disc");
  if (discs.length === 3) {
    discs[0].tint = "#8fb0c4"; discs[0].tintWeight = 0.85;
    discs[1].tint = "#a8c0b4"; discs[1].tintWeight = 0.8;
    discs[2].tint = "#c4b48f"; discs[2].tintWeight = 0.75;
  }
}
{
  const s = scenes.get("a30p");
  const [a, c] = s.entities.filter((e) => e.shape === "disc");
  if (a && c) { a.position.x = -0.28; c.position.x = 0.33; }
}

// ---- binding: rationales from actual usage ----------------------------------
const used = new Set();
const isText = (e) => e.shape === "text" || (!e.shape && e.text);
for (const s of j.scenes) for (const e of s.entities ?? []) {
  const g = (e.text ?? "").trim();
  if (g) used.add(g); else if (e.kind === "formation" && e.name) used.add(e.name);
  if (e.sequence?.enabled) for (const st of e.sequence.steps ?? []) { const sg = (st.text ?? "").trim(); if (sg) used.add(sg); }
}

const NEW_RATIONALES = {
  "the expectation it is fitted to": "the prepared human expectation a presentation is moulded on — the brief's glove fitted to a hand",
  "the worn presentation": "the mask as worn: persona, tone and fluency tuned until the fit itself documents its wearer",
  "the read-through": "the diaphanous reading — the view passed through the mask to the niche-formation that accomplishes it",
  "the light — appearing": "light figures appearing: the office that lets anything show at all",
  "the frame — camera-work": "camera-work: registration, retention and recall — the organisation of what the take keeps",
  "the action — consequence": "action: the consequence a framing makes possible — the response the staging admits",
  "what the frame cuts out": "the evaluator's other result, outside the frame — the difference that disappears from consideration",
  "the account acted through": "the ledger-circle of an institution acting through the ratio — the account as an acting thing",
  "the counted throughput": "one fast unit of the much larger counted field the ratio guides",
  "the uncounted, slower layer": "the human slowness the ratio omits, crossing the account's boundary into an explicit office",
  "the prompt — the executable threshold": "the prompt sign `>_`: where a request becomes executable — language, model and permissions waiting",
  "the run's threshold": "the crossing a request must make through the stack to count as run",
  "the request traversing": "the request itself: entered pale, executable through the threshold, issued as result",
  "the film — the world of mediation": "objective internality: the situated world within which composition occurs",
  "the essay being made": "the essay — a world made from within a world, off-centre because never from nowhere",
  "the lens taking itself as object": "the lens turned from the world onto its own making — self-application drawn",
  "the human institution": "the slower guiding layer: the human side of the crossover, paced in institutions",
  "the machine population": "the machine side of the crossover — faster, and pushing back into the contact",
  "the contact where alignment happens": "alignment lives in the contact, not prior to it — the widening ring of adoption and refactoring",
  "the reflexive field": "the field where a forecast can affect the event it forecasts — dependence with a direction",
  "the forecast": "the anticipated condition: a picture of what follows, able to inform what does",
  "the intervention": "the act the forecast informs — moving from prediction into the event it conditions",
  "the event re-conditioned": "the event whose conditioning is changed by the intervention the forecast informed",
};
for (const [g, r] of Object.entries(NEW_RATIONALES)) b.glyph_rationales[g] = r;

const pruned = [];
for (const g of Object.keys(b.glyph_rationales)) {
  if (!used.has(g)) { delete b.glyph_rationales[g]; pruned.push(g); }
}

b.recraft = {
  ...b.recraft,
  date: "2026-10-07",
  actor: "zcode:craft-lane-3",
  note: (b.recraft?.note ?? "") +
    " | continuation, same day: seven scenes re-drawn to carry their own faces (a04p mask-as-document, a05p light/camera/action offices, a10p uncounted entering the account, a18p prompt-run traversal with ascii prompt, a26p lens taking itself as object, a31p co-evolutionary tint drift through a widening contact, a34p forecast-intervention-event direction); mixture tints on a12p, genuine overlap on a30p; rationales rebuilt from actual glyph usage.",
};

writeFileSync(JP, JSON.stringify(j, null, 1) + "\n");
writeFileSync(BP, JSON.stringify(b, null, 1) + "\n");
console.log("conjugates re-drawn. formations:", j.scenes.reduce((a, s) => a + (s.entities ?? []).filter((e) => e.kind === "formation").length, 0),
  "| pruned rationales:", pruned.length, "| total rationales:", Object.keys(b.glyph_rationales).length);
