/**
 * Pure timing for the live character preview. It follows the authored
 * entity `sequence` the way the engine resolves it (fieldModel.ts
 * `resolveSequence`/`applyEasing`): each step dwells for its `hold`, then
 * morphs to the next over its `transition` with the sequence easing, in
 * `loop` or `pingpong` order. Switching state/gesture cross-fades over the
 * target Scene's authored transition duration. No DOM, so it is unit-tested.
 */
import type {CharacterPreviewMaterial} from "./characterModel";

export type Easing = "linear" | "smoothstep" | "kineticSnap" | "whip";

/** The engine's easing curves (expressions-app/src/engine/fieldModel.ts `applyEasing`). */
export function ease(u: number, easing: Easing | undefined): number {
  const t = Math.max(0, Math.min(1, u));
  switch (easing) {
    case "linear": return t;
    case "kineticSnap": return (Math.pow(t, .42) * (1 - Math.exp(-6 * t))) / (1 - Math.exp(-6));
    case "whip": return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    default: return t * t * (3 - 2 * t);
  }
}

/** One drawable look of the body. */
export interface CharacterLook {
  text: string;
  /** "text" draws the glyph or source; any other value is a drawn form. */
  shape: string;
  yantraId?: string;
  /** Cymatic/template frequency (Hz) for cymatic forms. */
  frequency?: number;
  ascii?: string;
  imageDataUrl?: string;
  tint: string | null;
  tintWeight: number;
  scale: number;
  /** Degrees (the authoring Entity's unit). */
  rotation: number;
}

/** A frame: the look being left, the look being approached and how far. */
export interface CharacterFrame {from: CharacterLook; to: CharacterLook; mix: number; step: number; phase: "hold" | "transition"}

export function baseLook(material: CharacterPreviewMaterial): CharacterLook {
  return {text: material.glyph, shape: material.shape, yantraId: material.yantraId, frequency: material.templateFrequency, ascii: material.ascii, imageDataUrl: material.imageDataUrl, tint: material.tint,
    tintWeight: material.tintWeight, scale: material.scale, rotation: material.rotation};
}

function stepLook(material: CharacterPreviewMaterial, index: number): CharacterLook {
  const base = baseLook(material), step = material.sequence.steps[index];
  if (!step) return base;
  const shape = step.shape ?? base.shape;
  const form = shape !== "text";
  return {
    // An empty step text on a text form keeps the body glyph visible.
    text: step.text || (form ? "" : base.text),
    shape,
    yantraId: step.yantraId ?? (shape === base.shape ? base.yantraId : undefined),
    frequency: step.templateFrequency ?? base.frequency,
    ascii: step.ascii ?? (step.imageDataUrl || form ? undefined : base.ascii),
    imageDataUrl: step.imageDataUrl ?? (step.ascii || form ? undefined : base.imageDataUrl),
    tint: step.tint ?? base.tint,
    tintWeight: step.tintWeight ?? base.tintWeight,
    scale: step.scale ?? base.scale,
    rotation: step.rotation ?? base.rotation,
  };
}

function orderIndex(k: number, n: number, order: string | undefined): number {
  if (order === "pingpong" && n > 1) { const period = 2 * (n - 1), m = k % period; return m < n ? m : period - m; }
  return k % n;
}

/** The body's look at `time` seconds into the state. A disabled or
 * single-step sequence holds the base look. */
export function frameAt(material: CharacterPreviewMaterial, time: number): CharacterFrame {
  const {sequence} = material;
  const n = sequence.steps.length;
  if (!sequence.enabled || n <= 1) {
    const look = n === 1 ? stepLook(material, 0) : baseLook(material);
    return {from: look, to: look, mix: 0, step: 0, phase: "hold"};
  }
  const hold = (i: number) => Math.max(0, sequence.steps[i].hold ?? sequence.hold);
  const glide = (i: number) => Math.max(0, sequence.steps[i].transition ?? sequence.transition);
  const periodSteps = sequence.order === "pingpong" ? 2 * (n - 1) : n;
  let cycle = 0;
  for (let k = 0; k < periodSteps; k++) cycle += Math.max(.05, hold(orderIndex(k, n, sequence.order)) + glide(orderIndex(k, n, sequence.order)));
  let local = ((time % cycle) + cycle) % cycle;
  for (let k = 0; k < periodSteps; k++) {
    const index = orderIndex(k, n, sequence.order), next = orderIndex(k + 1, n, sequence.order);
    const h = hold(index), g = glide(index), span = Math.max(.05, h + g);
    if (local < span || k === periodSteps - 1) {
      const from = stepLook(material, index), to = stepLook(material, next);
      if (local < h || g <= 0) return {from, to, mix: 0, step: index, phase: "hold"};
      return {from, to, mix: ease((local - h) / g, sequence.easing), step: index, phase: "transition"};
    }
    local -= span;
  }
  const look = stepLook(material, 0);
  return {from: look, to: look, mix: 0, step: 0, phase: "hold"};
}

const hex = (value: string | null): [number, number, number] | null => {
  if (!value) return null;
  const m = /^#([\da-f]{3}|[\da-f]{6})([\da-f]{2})?$/i.exec(value);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map(c => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
/** Mix a tint over the ink colour by weight; returns a CSS colour. */
export function inkColour(tint: string | null, weight: number, ink: [number, number, number]): string {
  const rgb = hex(tint), w = rgb ? Math.max(0, Math.min(1, weight)) : 0;
  const c = rgb ?? ink;
  return `rgb(${[0, 1, 2].map(i => Math.round(ink[i] + (c[i] - ink[i]) * w)).join(",")})`;
}

/** A light force motion: vortex spins, attract breathes in, repel breathes
 * out; every body jitters a little so the preview reads as alive. */
export function forceMotion(material: CharacterPreviewMaterial, time: number): {dx: number; dy: number; spin: number; breathe: number} {
  const strength = Math.min(1, Math.abs(material.forceStrength) / 5);
  const jitter = .015 + .03 * strength;
  const dx = Math.sin(time * 2.1) * jitter + Math.sin(time * 5.3) * jitter * .4;
  const dy = Math.cos(time * 1.7) * jitter + Math.cos(time * 4.9) * jitter * .4;
  switch (material.force) {
    case "vortex": return {dx, dy, spin: time * (20 + 40 * strength) * Math.sign(material.forceSpin || 1), breathe: 1};
    case "attract": return {dx, dy, spin: 0, breathe: 1 - .06 * strength * (.5 + .5 * Math.sin(time * 2))};
    case "repel": return {dx, dy, spin: 0, breathe: 1 + .06 * strength * (.5 + .5 * Math.sin(time * 2))};
    default: return {dx, dy, spin: 0, breathe: 1};
  }
}
