/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { CANONICAL_CHAKRAS } from "./chakraSystem.mjs";
const MAX_FORMATIONS = 10;
const MAX_PINS = 8;
let idCounter = 0;
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const DEFAULT_SEQUENCE = {
  links: [],
  advance: "off",
  hold: 1,
  transition: 2.2,
  easing: "smoothstep",
  order: "loop",
  jitter: 0,
  impulse: 0.6,
  phaseOffset: 0,
  rateMul: 1
};
const DEFAULT_FORCES = { mode: "none", strength: 2, radius: 220, spin: 0 };
const DEFAULT_COMPOSITION = {
  plane: "vertical",
  orchestration: { mode: "parallel", order: "listed", dwell: 1.4, glide: 2.4, followStation: true, focusTintWeight: 0.35 },
  entityTintWeight: 0.85,
  layoutName: "Single formation"
};
const DEFAULT_CYMATIC_MEDIUM = {
  enabled: false,
  engine: "resonator",
  plateGeometry: "square",
  dimension: "2D",
  frequencyHz: 396,
  autoSweep: false,
  sweepSpeed: 8,
  chaosIntensity: 1.4,
  nodalAttraction: 2.8,
  dampingQFactor: 4.5,
  dominance: 1,
  followFocus: true,
  plateSize: 700,
  baseFrequency: 40,
  driveStrength: 1,
  modeCount: 64,
  transportGain: 1,
  agitation: 0.3,
  boundaryStrength: 6,
  driveScale: 1
};
function makeLink(shape, pos) {
  return { id: newId("link"), shape: { ...shape }, ...pos || {} };
}
function makeFormation(overrides = {}) {
  return {
    id: newId("ent"),
    name: "Formation",
    kind: "formation",
    enabled: true,
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    share: 1,
    shape: { kind: "glyph", text: "O" },
    sequence: { ...DEFAULT_SEQUENCE, links: [] },
    forces: { ...DEFAULT_FORCES },
    tint: "#22d3ee",
    tintWeight: 0,
    ...overrides
  };
}
function makePin(overrides = {}) {
  return {
    ...makeFormation({ name: "Pin", kind: "pin", shape: { kind: "glyph", text: "" }, forces: { mode: "attract", strength: 2, radius: 220, spin: 0 }, tint: "#06b6d4" }),
    ...overrides,
    kind: "pin"
  };
}
function makeChakraEntities(shapeKind = "yantra") {
  return CANONICAL_CHAKRAS.map(
    (c, i) => makeFormation({
      id: `ent_chakra_${c.id}`,
      name: c.name,
      chakraId: c.id,
      stationIndex: CANONICAL_CHAKRAS.length - 1 - i,
      // root (last in the list) is station 0 (lowest frequency)
      x: c.x,
      y: -c.y,
      z: 0,
      scale: (c.scale ?? 0.2) * 2.4,
      shape: shapeKind === "cymatic" ? { kind: "cymatic", frequencyHz: c.frequencyHz } : shapeKind === "glyph" ? { kind: "glyph", text: c.seedSyllable } : { kind: "yantra", yantraId: c.id },
      forces: { mode: "vortex", strength: (c.attractorStrength ?? 2) * 0.6, radius: (c.scale ?? 0.2) * 450, spin: i % 2 === 0 ? 1.2 : -1.2 },
      tint: c.color,
      tintWeight: 1
    })
  );
}
const hash01 = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function effectiveLinks(e) {
  return e.sequence.links.length > 0 ? e.sequence.links : [{ id: e.id + "_base", shape: e.shape }];
}
function orderedIndex(step, count, order, seed = 0) {
  if (count <= 1) return 0;
  const s = Math.max(0, Math.floor(step));
  if (order === "loop") return s % count;
  if (order === "pingpong") {
    const period = (count - 1) * 2;
    const p = s % period;
    return p < count ? p : period - p;
  }
  let idx = Math.floor(hash01(seed) * count);
  for (let k = 1; k <= s; k++) {
    idx = (idx + 1 + Math.floor(hash01(k + seed) * (count - 1))) % count;
  }
  return idx;
}
function applyEasing(u, easing) {
  const t = Math.max(0, Math.min(1, u));
  switch (easing) {
    case "linear":
      return t;
    case "kineticSnap":
      return Math.pow(t, 0.42) * (1 - Math.exp(-6 * t)) / (1 - Math.exp(-6));
    case "whip":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    default:
      return t * t * (3 - 2 * t);
  }
}
function resolveSequence(e, simTime, drivePhase, manualMorph, holdRatio) {
  const links = effectiveLinks(e);
  const n = links.length;
  const seq = e.sequence;
  const seed = e.id.length * 7;
  if (n <= 1) return { linkIndex: 0, nextIndex: 0, progress: 0, phase: "hold", step: 0, linkCount: n };
  if (seq.advance === "off") {
    return { linkIndex: 0, nextIndex: orderedIndex(1, n, seq.order, seed), progress: Math.max(0, Math.min(1, manualMorph)), phase: "transition", step: 0, linkCount: n };
  }
  let step;
  let frac;
  let hold;
  if (seq.advance === "morphCycle") {
    const cycles = drivePhase / (Math.PI * 2) * seq.rateMul + seq.phaseOffset;
    step = Math.floor(cycles);
    frac = cycles - step;
    hold = Math.max(0, Math.min(0.95, holdRatio));
  } else if (links.some((l) => l.hold !== void 0 || l.transition !== void 0)) {
    const duration = (k2) => {
      const l = links[orderedIndex(k2, n, seq.order, seed)];
      return Math.max(0.05, (l.hold ?? seq.hold) + (l.transition ?? seq.transition));
    };
    let t = Math.max(0, simTime * seq.rateMul + seq.phaseOffset * duration(0));
    let k = 0;
    if (!seq.jitter && seq.order !== "random") {
      const routeLength = seq.order === "pingpong" ? Math.max(1, 2 * n - 2) : n;
      let cycleDuration = 0;
      for (let j = 0; j < routeLength; j++) cycleDuration += duration(j);
      const cycles = Math.floor(t / cycleDuration);
      k = cycles * routeLength;
      t -= cycles * cycleDuration;
    }
    let period = duration(k);
    for (let guard = 0; guard < 1e5; guard++) {
      period = duration(k) * Math.max(1e-3, 1 + (hash01(k + seed) - 0.5) * 2 * Math.min(1, seq.jitter));
      if (t < period) break;
      t -= period;
      k++;
    }
    step = k;
    frac = Math.min(1, t / period);
    const link = links[orderedIndex(k, n, seq.order, seed)];
    hold = Math.max(0, Math.min(0.99, (link.hold ?? seq.hold) / duration(k)));
  } else {
    const period = Math.max(0.05, seq.hold + seq.transition);
    const t = Math.max(0, simTime * seq.rateMul + seq.phaseOffset * period);
    let acc = 0;
    let k = 0;
    let stepPeriod = period;
    while (true) {
      stepPeriod = period * (1 + (hash01(k + seed) - 0.5) * 2 * Math.min(1, seq.jitter));
      if (acc + stepPeriod > t || k > 1e5) break;
      acc += stepPeriod;
      k++;
    }
    step = k;
    frac = Math.max(0, Math.min(1, (t - acc) / stepPeriod));
    hold = Math.max(0, Math.min(0.99, seq.hold / Math.max(0.05, seq.hold + seq.transition)));
  }
  const linkIndex = orderedIndex(step, n, seq.order, seed);
  const nextIndex = orderedIndex(step + 1, n, seq.order, seed);
  const u = hold >= 0.99 ? 0 : Math.max(0, Math.min(1, (frac - hold) / Math.max(1e-3, 1 - hold)));
  const progress = applyEasing(u, seq.easing);
  return { linkIndex, nextIndex, progress, phase: frac < hold ? "hold" : "transition", step, linkCount: n };
}
function resolveFocus(count, comp, simTime) {
  if (comp.orchestration.mode !== "focus" || count === 0) return null;
  const o = comp.orchestration;
  const period = Math.max(0.05, o.dwell + o.glide);
  const step = Math.floor(simTime / period);
  const frac = (simTime - step * period) / period;
  const holdFrac = o.dwell / period;
  const blend = frac < holdFrac ? 0 : (frac - holdFrac) / Math.max(1e-3, 1 - holdFrac);
  const orderMode = o.order === "pingpong" ? "pingpong" : "loop";
  const idxRaw = orderedIndex(step, count, orderMode);
  const nextRaw = orderedIndex(step + 1, count, orderMode);
  const index = o.order === "reverse" ? count - 1 - idxRaw : idxRaw;
  const nextIndex = o.order === "reverse" ? count - 1 - nextRaw : nextRaw;
  return { index, nextIndex, blend: blend * blend * (3 - 2 * blend), cycle: step };
}
function layoutPartitions(entities, particleCount) {
  const forms = entities.filter((e) => e.kind === "formation" && e.enabled).slice(0, MAX_FORMATIONS);
  if (forms.length === 0) return [];
  const total = forms.reduce((s, e) => s + Math.max(0.01, e.share), 0);
  const out = [];
  let cursor = 0;
  forms.forEach((e, i) => {
    const size = i === forms.length - 1 ? particleCount - cursor : Math.floor(Math.max(0.01, e.share) / total * particleCount);
    out.push({ entityId: e.id, start: cursor, end: cursor + size });
    cursor += size;
  });
  return out;
}
function nodeToShape(n) {
  if (n.shape === "glyph") return { kind: "glyph", text: n.glyphText || n.symbol || n.seedSyllable || "O" };
  if (n.shape === "cymatic") return { kind: "cymatic", frequencyHz: n.frequencyHz };
  return { kind: "yantra", yantraId: n.id };
}
function entityFromNode(n, index, chakraCount, influence, vortexPower) {
  const canonIdx = CANONICAL_CHAKRAS.findIndex((c) => c.id === n.id);
  return makeFormation({
    id: `ent_${n.id}`,
    name: n.name,
    chakraId: canonIdx >= 0 ? n.id : void 0,
    stationIndex: canonIdx >= 0 ? CANONICAL_CHAKRAS.length - 1 - canonIdx : Math.min(6, index),
    enabled: n.active !== false,
    x: n.x,
    y: -n.y,
    z: n.z ?? 0,
    scale: (n.scale ?? 0.2) * 2.4,
    shape: nodeToShape(n),
    forces: { mode: "vortex", strength: (n.attractorStrength ?? 2) * influence * 0.4, radius: (n.scale ?? 0.2) * 450, spin: (index % 2 === 0 ? 1 : -1) * vortexPower * 0.8 },
    tint: n.color,
    tintWeight: 1
  });
}
function migrateLegacyFieldConfig(cfg) {
  const composition = {
    ...DEFAULT_COMPOSITION,
    ...cfg.composition || {},
    orchestration: { ...DEFAULT_COMPOSITION.orchestration, ...cfg.composition?.orchestration || {} }
  };
  const cymatics = { ...DEFAULT_CYMATIC_MEDIUM, ...cfg.cymatics || {} };
  if (Array.isArray(cfg.entities)) {
    const entities2 = cfg.entities.map((e) => normaliseEntity(e));
    return { entities: entities2, composition, cymatics };
  }
  const entities = [];
  const sc = cfg.spatialChakra;
  if (sc && sc.enabled) {
    const nodes = sc.nodes && sc.nodes.length > 0 ? sc.nodes : CANONICAL_CHAKRAS;
    nodes.slice(0, MAX_FORMATIONS).forEach((n, i) => entities.push(entityFromNode(n, i, nodes.length, sc.attractorInfluence ?? 1.5, sc.vortexStrength ?? 1.5)));
    composition.plane = sc.plane === "horizontal" ? "horizontal" : "vertical";
    composition.orchestration = {
      ...composition.orchestration,
      mode: sc.playbackMode === "sequentialMorph" ? "focus" : "parallel",
      order: sc.cycleDirection === "descent" ? "reverse" : sc.cycleDirection === "pingpong" ? "pingpong" : "listed",
      dwell: sc.holdDuration ?? 1.2,
      glide: sc.transitionDuration ?? 2.4
    };
    composition.layoutName = sc.compositionName || "Chakra Body";
    if (sc.cymatics) Object.assign(cymatics, sc.cymatics);
    cymatics.enabled = sc.geometryMode === "cymatics";
    if (cymatics.enabled) cymatics.dominance = 1;
  } else {
    const g = cfg.glyph;
    const a = Array.isArray(g) ? String(g[0] ?? "O") : typeof g === "string" ? g : "O";
    const b = Array.isArray(g) ? String(g[1] ?? a) : a;
    const ch = cfg.chaining;
    const main = makeFormation({ id: "ent_main", name: "Main", shape: { kind: "glyph", text: a }, tintWeight: 0 });
    if (ch && ch.enabled && ch.chain && ch.chain.length > 0) {
      main.sequence = {
        ...DEFAULT_SEQUENCE,
        links: ch.chain.map((t) => makeLink({ kind: "glyph", text: t })),
        advance: ch.advance === "morphCycle" ? "morphCycle" : "time",
        hold: ch.stepHoldDuration ?? 1,
        transition: ch.transitionDuration ?? 2.2,
        easing: ch.easing || "smoothstep",
        order: ch.mode === "pingpong" ? "pingpong" : ch.mode === "loop" ? "loop" : "random",
        jitter: ch.timingJitter ?? 0,
        impulse: ch.disperseImpulse ?? 0.6
      };
    } else {
      main.sequence = {
        ...DEFAULT_SEQUENCE,
        links: [makeLink({ kind: "glyph", text: a }), makeLink({ kind: "glyph", text: b })],
        advance: cfg.autoMorph === false ? "off" : "time",
        order: "pingpong",
        hold: 0.2,
        transition: Math.max(0.1, (cfg.autoMorphDuration ?? 4) - 0.2),
        easing: "smoothstep"
      };
    }
    entities.push(main);
    if (cfg.spatialChakra?.cymatics) Object.assign(cymatics, cfg.spatialChakra.cymatics, { enabled: false });
  }
  const pins = cfg.interaction?.placedPoints || [];
  pins.slice(0, MAX_PINS).forEach((p) => {
    entities.push(
      makePin({
        id: p.id,
        name: p.name || "Pin",
        enabled: p.active !== false,
        x: p.x,
        y: p.y,
        z: p.z ?? 0,
        forces: { mode: p.mode, strength: p.strength, radius: p.radius, spin: 0 }
      })
    );
  });
  return { entities, composition, cymatics };
}
function normaliseEntity(raw) {
  const base = raw?.kind === "pin" ? makePin() : makeFormation();
  const e = {
    ...base,
    ...raw,
    shape: raw?.shape && typeof raw.shape === "object" ? { ...raw.shape, kind: raw.shape.kind ?? "glyph", ...raw.shape.kind === "glyph" || !raw.shape.kind ? { text: raw.shape.text ?? "O" } : {} } : { ...base.shape },
    sequence: {
      ...DEFAULT_SEQUENCE,
      ...raw?.sequence || {},
      links: Array.isArray(raw?.sequence?.links) ? raw.sequence.links.filter((l) => l && l.shape).map((l) => ({ ...l, id: l.id || newId("link"), shape: { kind: "glyph", ...l.shape } })) : []
    },
    forces: { ...DEFAULT_FORCES, ...raw?.forces || {} }
  };
  e.kind = raw?.kind === "pin" ? "pin" : "formation";
  e.id = typeof raw?.id === "string" && raw.id ? raw.id : newId("ent");
  return e;
}
function pinsToPlacedPoints(entities) {
  return entities.filter((e) => e.kind === "pin").slice(0, MAX_PINS).map((e) => ({
    id: e.id,
    name: e.name,
    x: e.x,
    y: e.y,
    z: e.z,
    radius: e.forces.radius,
    strength: e.forces.mode === "none" ? 0 : e.forces.strength,
    spin: e.forces.spin,
    falloff: "gaussian",
    mode: e.forces.mode === "none" ? "repel" : e.forces.mode,
    active: e.enabled && (e.forces.mode !== "none" || Math.abs(e.forces.spin) > 0)
  }));
}
const COMPOSITION_PRESETS = [
  {
    id: "single_glyph",
    name: "Single Glyph Morph",
    description: "One formation morphing O \u21C4 I on the field drive",
    build: () => ({
      entities: [
        makeFormation({
          id: "ent_main",
          name: "Main",
          shape: { kind: "glyph", text: "O" },
          sequence: { ...DEFAULT_SEQUENCE, links: [makeLink({ kind: "glyph", text: "O" }), makeLink({ kind: "glyph", text: "I" })], advance: "time", order: "pingpong", hold: 0.2, transition: 3.8 }
        })
      ],
      composition: { plane: "vertical", orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: "parallel" }, layoutName: "Single formation" },
      cymatics: { enabled: false }
    })
  },
  {
    id: "chakra_body",
    name: "Chakra Body \xB7 7 centres",
    description: "Seven yantra formations along the spine, each a vortex centre with its own tint",
    build: () => ({
      entities: makeChakraEntities("yantra"),
      composition: { plane: "vertical", orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: "parallel" }, entityTintWeight: 0.9, layoutName: "Chakra Body" },
      cymatics: { enabled: false }
    })
  },
  {
    id: "kundalini_focus",
    name: "Kundalini \xB7 travelling focus",
    description: "Chakra body with a focus that climbs Root \u2192 Crown, carrying tint and cymatic station",
    build: () => ({
      entities: makeChakraEntities("yantra"),
      composition: { plane: "vertical", orchestration: { mode: "focus", order: "reverse", dwell: 1.4, glide: 2.4, followStation: true, focusTintWeight: 0.6 }, entityTintWeight: 0.7, layoutName: "Kundalini" },
      cymatics: { enabled: false }
    })
  },
  {
    id: "cymatic_plate",
    name: "Cymatic Plate \xB7 resonator",
    description: "Pure driven plate: geometry emerges from the resonator, sweep through the seven stations",
    build: () => ({
      entities: [makeFormation({ id: "ent_medium", name: "Medium", shape: { kind: "glyph", text: "\u25CF" }, forces: { ...DEFAULT_FORCES, mode: "none" }, tintWeight: 0 })],
      composition: { plane: "horizontal", orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: "parallel" }, layoutName: "Cymatic plate" },
      cymatics: { enabled: true, dominance: 1, autoSweep: true, followFocus: false }
    })
  },
  {
    id: "chakra_cymatic",
    name: "Chakra centres over a resonant plate",
    description: "Seven tinted centres shaping a half-dominant cymatic medium; focus follows stations",
    build: () => ({
      entities: makeChakraEntities("yantra"),
      composition: { plane: "vertical", orchestration: { mode: "focus", order: "reverse", dwell: 2, glide: 3, followStation: true, focusTintWeight: 0.5 }, entityTintWeight: 0.8, layoutName: "Chakra \xD7 Cymatic" },
      cymatics: { enabled: true, dominance: 0.55, autoSweep: false, followFocus: true }
    })
  }
];
export {
  COMPOSITION_PRESETS,
  DEFAULT_COMPOSITION,
  DEFAULT_CYMATIC_MEDIUM,
  DEFAULT_FORCES,
  DEFAULT_SEQUENCE,
  MAX_FORMATIONS,
  MAX_PINS,
  applyEasing,
  effectiveLinks,
  entityFromNode,
  layoutPartitions,
  makeChakraEntities,
  makeFormation,
  makeLink,
  makePin,
  migrateLegacyFieldConfig,
  newId,
  normaliseEntity,
  orderedIndex,
  pinsToPlacedPoints,
  resolveFocus,
  resolveSequence
};
