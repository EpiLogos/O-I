/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * FIELD / ENTITY / COMPOSITION CONTRACT
 * =====================================
 * One particle medium ("the field"), organised by first-class entities, orchestrated by a composition.
 *
 *  FIELD        shared physics, colour palette, particles, pointer, relational attractors, the global
 *               morph drive (dual-phase oscillator) and the cymatic medium (continuously driven resonator).
 *  ENTITY       an identity with a position in 3D, an optional formation (a shape + its own sequence of
 *               shapes that unfold over time), local forces (attract / repel / vortex) and a colour tint.
 *               kind 'formation' owns a partition of the particles; kind 'pin' is a pure force centre.
 *  COMPOSITION  how entities share the field: plane, orchestration (parallel, or a travelling focus
 *               that carries tint + cymatic station), tint weights and layout metadata.
 *
 * OWNERSHIP (single writer per concern)
 *  - particle TARGET shapes .......... entity.shape / entity.sequence   (baked per partition, local coords)
 *  - entity POSITION ................. entity.x/y/z (+ per-link offsets)  → uniforms, never a re-bake
 *  - MORPH progress .................. field morph drive (global θ/φ) resolved per entity by phaseOffset/rateMul
 *  - COLOUR .......................... field palette (config.color) + entity tints (weighted) + focus tint
 *  - CYMATIC frequency ............... field.cymatics.frequencyHz, or the focused entity's station when followFocus
 *  - TIME ............................ one clock: engine simTime. Sequence + focus are pure functions of it.
 *
 * COMBINATION RULES
 *  - Entity forces are summed over the whole medium (every particle feels every enabled entity, gaussian falloff).
 *  - Formation springs pull each partition to its own targets; the cymatic medium's transport is blended with
 *    the springs by field.cymatics.dominance (0 = pure formations, 1 = pure resonator).
 *  - Nothing reseeds particle positions except an explicit reset or a particle-count change.
 */

import type { ChainEasing, CymaticsConfig, PointCloudConfig, SpatialChakraNode } from './types';
import { CANONICAL_CHAKRAS } from './chakraSystem';

export const MAX_FORMATIONS = 10;
export const MAX_PINS = 8;

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------
export type ShapeKind = 'glyph' | 'yantra' | 'cymatic' | 'primitive';

export interface Shape {
  /** Optional authored-template overrides; absent values inherit field template settings. */
  plateGeometry?: CymaticsConfig['plateGeometry'];
  dimension?: CymaticsConfig['dimension'];
  primitive?: 'ring' | 'disc' | 'square' | 'triangle';
  kind: ShapeKind;
  text?: string;          // glyph / word (kind 'glyph')
  yantraId?: string;      // sacred geometry id from CANONICAL_CHAKRAS (kind 'yantra')
  frequencyHz?: number;   // Chladni template frequency (kind 'cymatic', authored geometry — NOT the resonator)
}

export interface SequenceLink {
  source?:Entity['authoringSource'];
  state?:Pick<Entity,'extent'|'scale'|'tint'|'tintWeight'|'forces'>;
  name?:string;
  /** Optional authored timing; absent values inherit the entity sequence. */
  hold?: number;
  transition?: number;
  id: string;
  shape: Shape;
  x?: number;             // optional per-link centre offset (world px) — the entity glides here on this link
  y?: number;
  z?: number;
}

export type SequenceAdvance = 'off' | 'time' | 'morphCycle';
export type SequenceOrder = 'loop' | 'pingpong' | 'random';

export interface EntitySequence {
  links: SequenceLink[];  // ≥ 1. With one link the formation is static.
  advance: SequenceAdvance;
  hold: number;           // seconds dwelling on a link (advance 'time')
  transition: number;     // seconds morphing to the next link (advance 'time')
  easing: ChainEasing;
  order: SequenceOrder;
  jitter: number;         // 0..1 organic timing variation (deterministic per link)
  impulse: number;        // fluid burst on link change
  phaseOffset: number;    // cycles, shifts this entity's timeline relative to the global drive
  rateMul: number;        // timeline speed multiplier
}

export type EntityForceMode = 'none' | 'attract' | 'repel' | 'vortex';

export interface EntityForces {
  mode: EntityForceMode;
  strength: number;       // radial force (attract/repel) or swirl torque (vortex)
  radius: number;         // world px; gaussian / quadratic falloff radius
  spin: number;           // extra tangential swirl added for any mode (signed)
}

export type EntityKind = 'formation' | 'pin';

export interface Entity {
  authoringSource?: {kind:'image';image:import('./types').CustomImageConfig}|{kind:'ascii';ascii:import('./types').AsciiGlyphConfig};
  id: string;
  name: string;
  kind: EntityKind;
  enabled: boolean;
  x: number;
  y: number;
  z: number;
  /** Normalized 400-unit target extents. Transforms are uniforms, not baked geometry. */
  extent?: {width: number; height: number; rotation: number; normalized?: boolean};
  scale: number;          // formation size multiplier (yantra/glyph rasters are normalised to ~1)
  share: number;          // relative particle share among enabled formations (weight, default 1)
  shape: Shape;           // base shape (also link 0 when the sequence is empty)
  /** Laminated composition: when present, the body is the union of these layers. */
  layers?: EntityLayer[];
  sequence: EntitySequence;
  forces: EntityForces;
  tint: string;           // hex colour contributed to this entity's particles
  tintWeight: number;     // 0..1 how strongly the tint overrides the field palette
  stationIndex?: number;  // link to a cymatic resonator station (0..6) — used by focus/followFocus
  chakraId?: string;      // provenance when created from the canonical chakra body
}

/**
 * One layer of a laminated object. Layers are the spatial composition of an
 * entity — parallel to its sequence, which is the temporal one. The formation's
 * particle allocation is subdivided across the layers, and each layer draws its
 * shape (or its loaded image/ASCII source, via the per-layer custom pool) in
 * the depth band its `z` occupies, with its own measured body thickness. The
 * whole layered body then sequences and morphs as one object: states transform
 * it (size, rotation, tint, forces, placement) through the ordinary uniforms.
 */
export interface EntityLayer {
  id: string;
  z: number;              // depth band centre, world px, relative to the entity
  shape: Shape;           // geometry when no image/ASCII source is loaded for this layer
  scale?: number;         // in-plane multiplier on the layer's pool
}

export type OrchestrationMode = 'parallel' | 'focus';
export type FocusOrder = 'listed' | 'reverse' | 'pingpong';

export interface Composition {
  plane: 'vertical' | 'horizontal';   // XY facing the camera, or XZ flat plate
  orchestration: {
    mode: OrchestrationMode;
    order: FocusOrder;
    dwell: number;                    // seconds the focus rests on an entity
    glide: number;                    // seconds the focus travels to the next
    followStation: boolean;           // focus drives the cymatic frequency to the entity's station
    focusTintWeight: number;          // 0..1 global tint toward the focused entity's colour
  };
  entityTintWeight: number;           // 0..1 master multiplier on per-entity tints
  layoutName?: string;
}

export interface CymaticMedium extends CymaticsConfig {
  enabled: boolean;
  dominance: number;      // 0..1 blend between formation springs (0) and resonator transport (1)
  followFocus: boolean;   // when the composition focus lands on an entity with a station, glide to its frequency
}

// ---------------------------------------------------------------------------------------------
// Defaults & factories
// ---------------------------------------------------------------------------------------------
let idCounter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const DEFAULT_SEQUENCE: EntitySequence = {
  links: [],
  advance: 'off',
  hold: 1.0,
  transition: 2.2,
  easing: 'smoothstep',
  order: 'loop',
  jitter: 0,
  impulse: 0.6,
  phaseOffset: 0,
  rateMul: 1,
};

export const DEFAULT_FORCES: EntityForces = { mode: 'none', strength: 2.0, radius: 220, spin: 0 };

export const DEFAULT_COMPOSITION: Composition = {
  plane: 'vertical',
  orchestration: { mode: 'parallel', order: 'listed', dwell: 1.4, glide: 2.4, followStation: true, focusTintWeight: 0.35 },
  entityTintWeight: 0.85,
  layoutName: 'Single formation',
};

export const DEFAULT_CYMATIC_MEDIUM: CymaticMedium = {
  enabled: false,
  engine: 'resonator',
  plateGeometry: 'square',
  dimension: '2D',
  frequencyHz: 396,
  autoSweep: false,
  sweepSpeed: 8.0,
  chaosIntensity: 1.4,
  nodalAttraction: 2.8,
  dampingQFactor: 4.5,
  dominance: 1.0,
  followFocus: true,
  plateSize: 700, baseFrequency: 40, driveStrength: 1, modeCount: 64,
  transportGain: 1, agitation: 0.3, boundaryStrength: 6, driveScale: 1,
};

export function makeLink(shape: Shape, pos?: { x?: number; y?: number; z?: number }): SequenceLink {
  return { id: newId('link'), shape: { ...shape }, ...(pos || {}) };
}

export const makeLayer = (z: number, shape: Shape, overrides: Partial<EntityLayer> = {}): EntityLayer => ({
  id: newId('layer'),
  z,
  shape: { ...shape },
  ...overrides,
});

export function makeFormation(overrides: Partial<Entity> = {}): Entity {
  return {
    id: newId('ent'),
    name: 'Formation',
    kind: 'formation',
    enabled: true,
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    share: 1,
    shape: { kind: 'glyph', text: 'O' },
    sequence: { ...DEFAULT_SEQUENCE, links: [] },
    forces: { ...DEFAULT_FORCES },
    tint: '#22d3ee',
    tintWeight: 0,
    ...overrides,
  };
}

export function makePin(overrides: Partial<Entity> = {}): Entity {
  return {
    ...makeFormation({ name: 'Pin', kind: 'pin', shape: { kind: 'glyph', text: '' }, forces: { mode: 'attract', strength: 2.0, radius: 220, spin: 0 }, tint: '#06b6d4' }),
    ...overrides,
    kind: 'pin',
  };
}

/** The canonical chakra body expressed as seven formation entities (positions from CANONICAL_CHAKRAS). */
export function makeChakraEntities(shapeKind: ShapeKind = 'yantra'): Entity[] {
  return CANONICAL_CHAKRAS.map((c, i) =>
    makeFormation({
      id: `ent_chakra_${c.id}`,
      name: c.name,
      chakraId: c.id,
      stationIndex: CANONICAL_CHAKRAS.length - 1 - i, // root (last in the list) is station 0 (lowest frequency)
      x: c.x,
      y: -c.y,
      z: 0,
      scale: (c.scale ?? 0.2) * 2.4,
      shape: shapeKind === 'cymatic' ? { kind: 'cymatic', frequencyHz: c.frequencyHz } : shapeKind === 'glyph' ? { kind: 'glyph', text: c.seedSyllable } : { kind: 'yantra', yantraId: c.id },
      forces: { mode: 'vortex', strength: (c.attractorStrength ?? 2) * 0.6, radius: (c.scale ?? 0.2) * 450, spin: i % 2 === 0 ? 1.2 : -1.2 },
      tint: c.color,
      tintWeight: 1,
    })
  );
}

// ---------------------------------------------------------------------------------------------
// Pure resolvers — everything is a function of simTime; no timers anywhere.
// ---------------------------------------------------------------------------------------------
export interface SequenceState {
  linkIndex: number;       // current link (index into effectiveLinks)
  nextIndex: number;
  progress: number;        // 0..1 eased progress toward next link
  phase: 'hold' | 'transition';
  step: number;            // monotonic step counter (changes exactly when the current link changes)
  linkCount: number;
}

const hash01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function effectiveLinks(e: Entity): SequenceLink[] {
  return e.sequence.links.length > 0 ? e.sequence.links : [{ id: e.id + '_base', shape: e.shape }];
}

/** Map a monotonic step counter to a link index under the sequence order rule. */
export function orderedIndex(step: number, count: number, order: SequenceOrder, seed = 0): number {
  if (count <= 1) return 0;
  const s = Math.max(0, Math.floor(step));
  if (order === 'loop') return s % count;
  if (order === 'pingpong') {
    const period = (count - 1) * 2;
    const p = s % period;
    return p < count ? p : period - p;
  }
  // random: deterministic walk that never repeats the same link twice in a row. Each step picks one
  // of the (count − 1) links other than the previous one, so the guarantee holds by construction.
  let idx = Math.floor(hash01(seed) * count);
  for (let k = 1; k <= s; k++) {
    idx = (idx + 1 + Math.floor(hash01(k + seed) * (count - 1))) % count;
  }
  return idx;
}

export function applyEasing(u: number, easing: ChainEasing): number {
  const t = Math.max(0, Math.min(1, u));
  switch (easing) {
    case 'linear':
      return t;
    case 'kineticSnap':
      return (Math.pow(t, 0.42) * (1 - Math.exp(-6 * t))) / (1 - Math.exp(-6));
    case 'whip':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    default:
      return t * t * (3 - 2 * t);
  }
}

/**
 * Resolve an entity's sequence position from the global clock.
 *  simTime        engine seconds
 *  drivePhase     global toroidal phase θ (radians) for 'morphCycle'
 *  manualMorph    field-level manual scrub used when advance === 'off'
 *  holdRatio      global dwell ratio from the morph drive (morphCycle)
 */
export function resolveSequence(
  e: Entity,
  simTime: number,
  drivePhase: number,
  manualMorph: number,
  holdRatio: number
): SequenceState {
  const links = effectiveLinks(e);
  const n = links.length;
  const seq = e.sequence;
  const seed = e.id.length * 7;
  if (n <= 1) return { linkIndex: 0, nextIndex: 0, progress: 0, phase: 'hold', step: 0, linkCount: n };

  if (seq.advance === 'off') {
    return { linkIndex: 0, nextIndex: orderedIndex(1, n, seq.order, seed), progress: Math.max(0, Math.min(1, manualMorph)), phase: 'transition', step: 0, linkCount: n };
  }

  let step: number;
  let frac: number;
  let hold: number;
  if (seq.advance === 'morphCycle') {
    const cycles = (drivePhase / (Math.PI * 2)) * seq.rateMul + seq.phaseOffset;
    step = Math.floor(cycles);
    frac = cycles - step;
    hold = Math.max(0, Math.min(0.95, holdRatio));
  } else if (links.some(l => l.hold !== undefined || l.transition !== undefined)) {
    const duration = (k: number) => {
      const l = links[orderedIndex(k, n, seq.order, seed)];
      return Math.max(0.05, (l.hold ?? seq.hold) + (l.transition ?? seq.transition));
    };
    let t = Math.max(0, simTime * seq.rateMul + seq.phaseOffset * duration(0));
    let k = 0;
    // Deterministic periodic routes can skip whole periods without losing timing.
    if (!seq.jitter && seq.order !== 'random') {
      const routeLength = seq.order === 'pingpong' ? Math.max(1, 2 * n - 2) : n;
      let cycleDuration = 0;
      for (let j = 0; j < routeLength; j++) cycleDuration += duration(j);
      const cycles = Math.floor(t / cycleDuration);
      k = cycles * routeLength; t -= cycles * cycleDuration;
    }
    let period = duration(k);
    for (let guard = 0; guard < 100000; guard++) {
      period = duration(k) * Math.max(0.001, 1 + (hash01(k + seed) - 0.5) * 2 * Math.min(1, seq.jitter));
      if (t < period) break;
      t -= period; k++;
    }
    step = k; frac = Math.min(1, t / period);
    const link = links[orderedIndex(k, n, seq.order, seed)];
    hold = Math.max(0, Math.min(0.99, (link.hold ?? seq.hold) / duration(k)));
  } else {
    const period = Math.max(0.05, seq.hold + seq.transition);
    const t = Math.max(0, simTime * seq.rateMul + seq.phaseOffset * period);
    // deterministic jitter: each step's period is scaled by a stable pseudo-random factor
    let acc = 0;
    let k = 0;
    // walk periods until we pass t (bounded to keep it O(1) in practice: periods are ≥ 0.05s)
    let stepPeriod = period;
    while (true) {
      stepPeriod = period * (1 + (hash01(k + seed) - 0.5) * 2 * Math.min(1, seq.jitter));
      if (acc + stepPeriod > t || k > 100000) break;
      acc += stepPeriod;
      k++;
    }
    step = k;
    frac = Math.max(0, Math.min(1, (t - acc) / stepPeriod));
    hold = Math.max(0, Math.min(0.99, seq.hold / Math.max(0.05, seq.hold + seq.transition)));
  }
  const linkIndex = orderedIndex(step, n, seq.order, seed);
  const nextIndex = orderedIndex(step + 1, n, seq.order, seed);
  const u = hold >= 0.99 ? 0 : Math.max(0, Math.min(1, (frac - hold) / Math.max(0.001, 1 - hold)));
  const progress = applyEasing(u, seq.easing);
  return { linkIndex, nextIndex, progress, phase: frac < hold ? 'hold' : 'transition', step, linkCount: n };
}

export interface FocusState {
  index: number;        // focused entity index within the ordered formation list
  nextIndex: number;
  blend: number;        // 0..1 travel progress toward next
  cycle: number;
}

/** Travelling focus: which formation the composition is "on", as a pure function of time. */
export function resolveFocus(count: number, comp: Composition, simTime: number): FocusState | null {
  if (comp.orchestration.mode !== 'focus' || count === 0) return null;
  const o = comp.orchestration;
  const period = Math.max(0.05, o.dwell + o.glide);
  const step = Math.floor(simTime / period);
  const frac = (simTime - step * period) / period;
  const holdFrac = o.dwell / period;
  const blend = frac < holdFrac ? 0 : (frac - holdFrac) / Math.max(0.001, 1 - holdFrac);
  const orderMode: SequenceOrder = o.order === 'pingpong' ? 'pingpong' : 'loop';
  const idxRaw = orderedIndex(step, count, orderMode);
  const nextRaw = orderedIndex(step + 1, count, orderMode);
  const index = o.order === 'reverse' ? count - 1 - idxRaw : idxRaw;
  const nextIndex = o.order === 'reverse' ? count - 1 - nextRaw : nextRaw;
  return { index, nextIndex, blend: blend * blend * (3 - 2 * blend), cycle: step };
}

/** Particle partition layout: contiguous ranges proportional to share among enabled formations. */
export interface Partition {
  entityId: string;
  start: number;
  end: number; // exclusive
}

export function layoutPartitions(entities: Entity[], particleCount: number): Partition[] {
  const forms = entities.filter((e) => e.kind === 'formation' && e.enabled).slice(0, MAX_FORMATIONS);
  if (forms.length === 0) return [];
  const total = forms.reduce((s, e) => s + Math.max(0.01, e.share), 0);
  const out: Partition[] = [];
  let cursor = 0;
  forms.forEach((e, i) => {
    const size = i === forms.length - 1 ? particleCount - cursor : Math.floor((Math.max(0.01, e.share) / total) * particleCount);
    out.push({ entityId: e.id, start: cursor, end: cursor + size });
    cursor += size;
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Legacy migration: glyph / chaining / spatialChakra → entities + composition + cymatic medium
// ---------------------------------------------------------------------------------------------
function nodeToShape(n: SpatialChakraNode): Shape {
  if (n.shape === 'glyph') return { kind: 'glyph', text: n.glyphText || n.symbol || n.seedSyllable || 'O' };
  if (n.shape === 'cymatic') return { kind: 'cymatic', frequencyHz: n.frequencyHz };
  return { kind: 'yantra', yantraId: n.id };
}

export function entityFromNode(n: SpatialChakraNode, index: number, chakraCount: number, influence: number, vortexPower: number): Entity {
  const canonIdx = CANONICAL_CHAKRAS.findIndex((c) => c.id === n.id);
  return makeFormation({
    id: `ent_${n.id}`,
    name: n.name,
    chakraId: canonIdx >= 0 ? n.id : undefined,
    stationIndex: canonIdx >= 0 ? CANONICAL_CHAKRAS.length - 1 - canonIdx : Math.min(6, index),
    enabled: n.active !== false,
    x: n.x,
    y: -n.y,
    z: n.z ?? 0,
    scale: (n.scale ?? 0.2) * 2.4,
    shape: nodeToShape(n),
    forces: { mode: 'vortex', strength: (n.attractorStrength ?? 2) * influence * 0.4, radius: (n.scale ?? 0.2) * 450, spin: (index % 2 === 0 ? 1 : -1) * vortexPower * 0.8 },
    tint: n.color,
    tintWeight: 1,
  });
}

/**
 * Builds { entities, composition, cymatics } from a config that may still carry legacy keys.
 * Idempotent: configs that already have entities are returned as-is (normalised).
 */
export function migrateLegacyFieldConfig(cfg: Partial<PointCloudConfig>): {
  entities: Entity[];
  composition: Composition;
  cymatics: CymaticMedium;
} {
  const composition: Composition = {
    ...DEFAULT_COMPOSITION,
    ...(cfg.composition || {}),
    orchestration: { ...DEFAULT_COMPOSITION.orchestration, ...((cfg.composition as any)?.orchestration || {}) },
  };
  const cymatics: CymaticMedium = { ...DEFAULT_CYMATIC_MEDIUM, ...((cfg.cymatics as any) || {}) };

  if (Array.isArray(cfg.entities)) {
    const entities = cfg.entities.map((e) => normaliseEntity(e));
    return { entities, composition, cymatics };
  }

  const entities: Entity[] = [];
  const sc = cfg.spatialChakra;
  if (sc && sc.enabled) {
    const nodes = sc.nodes && sc.nodes.length > 0 ? sc.nodes : CANONICAL_CHAKRAS;
    nodes.slice(0, MAX_FORMATIONS).forEach((n, i) => entities.push(entityFromNode(n, i, nodes.length, sc.attractorInfluence ?? 1.5, sc.vortexStrength ?? 1.5)));
    composition.plane = sc.plane === 'horizontal' ? 'horizontal' : 'vertical';
    composition.orchestration = {
      ...composition.orchestration,
      mode: sc.playbackMode === 'sequentialMorph' ? 'focus' : 'parallel',
      order: sc.cycleDirection === 'descent' ? 'reverse' : sc.cycleDirection === 'pingpong' ? 'pingpong' : 'listed',
      dwell: sc.holdDuration ?? 1.2,
      glide: sc.transitionDuration ?? 2.4,
    };
    composition.layoutName = sc.compositionName || 'Chakra Body';
    if (sc.cymatics) Object.assign(cymatics, sc.cymatics);
    cymatics.enabled = sc.geometryMode === 'cymatics';
    if (cymatics.enabled) cymatics.dominance = 1.0;
  } else {
    // Single main formation from glyph A/B (+ chaining as its sequence)
    const g = cfg.glyph;
    const a = Array.isArray(g) ? String(g[0] ?? 'O') : typeof g === 'string' ? g : 'O';
    const b = Array.isArray(g) ? String(g[1] ?? a) : a;
    const ch = cfg.chaining;
    const main = makeFormation({ id: 'ent_main', name: 'Main', shape: { kind: 'glyph', text: a }, tintWeight: 0 });
    if (ch && ch.enabled && ch.chain && ch.chain.length > 0) {
      main.sequence = {
        ...DEFAULT_SEQUENCE,
        links: ch.chain.map((t) => makeLink({ kind: 'glyph', text: t })),
        advance: ch.advance === 'morphCycle' ? 'morphCycle' : 'time',
        hold: ch.stepHoldDuration ?? 1,
        transition: ch.transitionDuration ?? 2.2,
        easing: ch.easing || 'smoothstep',
        order: ch.mode === 'pingpong' ? 'pingpong' : ch.mode === 'loop' ? 'loop' : 'random',
        jitter: ch.timingJitter ?? 0,
        impulse: ch.disperseImpulse ?? 0.6,
      };
    } else {
      main.sequence = {
        ...DEFAULT_SEQUENCE,
        links: [makeLink({ kind: 'glyph', text: a }), makeLink({ kind: 'glyph', text: b })],
        advance: cfg.autoMorph === false ? 'off' : 'time',
        order: 'pingpong',
        hold: 0.2,
        transition: Math.max(0.1, (cfg.autoMorphDuration ?? 4) - 0.2),
        easing: 'smoothstep',
      };
    }
    entities.push(main);
    if (cfg.spatialChakra?.cymatics) Object.assign(cymatics, cfg.spatialChakra.cymatics, { enabled: false });
  }

  // Pins from placedPoints
  const pins = cfg.interaction?.placedPoints || [];
  pins.slice(0, MAX_PINS).forEach((p) => {
    entities.push(
      makePin({
        id: p.id,
        name: p.name || 'Pin',
        enabled: p.active !== false,
        x: p.x,
        y: p.y,
        z: p.z ?? 0,
        forces: { mode: p.mode, strength: p.strength, radius: p.radius, spin: 0 },
      })
    );
  });

  return { entities, composition, cymatics };
}

export function normaliseEntity(raw: any): Entity {
  const base = raw?.kind === 'pin' ? makePin() : makeFormation();
  const e: Entity = {
    ...base,
    ...raw,
    shape: raw?.shape && typeof raw.shape === 'object'
      ? { ...raw.shape, kind: raw.shape.kind ?? 'glyph', ...(raw.shape.kind === 'glyph' || !raw.shape.kind ? { text: raw.shape.text ?? 'O' } : {}) }
      : { ...base.shape },
    sequence: {
      ...DEFAULT_SEQUENCE,
      ...(raw?.sequence || {}),
      links: Array.isArray(raw?.sequence?.links)
        ? raw.sequence.links.filter((l: any) => l && l.shape).map((l: any) => ({ ...l, id: l.id || newId('link'), shape: { kind: 'glyph', ...l.shape } }))
        : [],
    },
    forces: { ...DEFAULT_FORCES, ...(raw?.forces || {}) },
  };
  e.kind = raw?.kind === 'pin' ? 'pin' : 'formation';
  e.id = typeof raw?.id === 'string' && raw.id ? raw.id : newId('ent');
  return e;
}

/** Pins (kind 'pin') expressed as the simulator's placed-point list. */
export function pinsToPlacedPoints(entities: Entity[]) {
  return entities
    .filter((e) => e.kind === 'pin')
    .slice(0, MAX_PINS)
    .map((e) => ({
      id: e.id,
      name: e.name,
      x: e.x,
      y: e.y,
      z: e.z,
      radius: e.forces.radius,
      strength: e.forces.mode === 'none' ? 0 : e.forces.strength,
      spin: e.forces.spin,
      falloff: 'gaussian' as const,
      mode: (e.forces.mode === 'none' ? 'repel' : e.forces.mode) as 'repel' | 'attract' | 'vortex',
      active: e.enabled && (e.forces.mode !== 'none' || Math.abs(e.forces.spin) > 0),
    }));
}

// ---------------------------------------------------------------------------------------------
// Composition presets (quick setups; all expressed through the same entity system)
// ---------------------------------------------------------------------------------------------
export interface CompositionPreset {
  id: string;
  name: string;
  description: string;
  build: () => { entities: Entity[]; composition: Partial<Composition>; cymatics?: Partial<CymaticMedium> };
}

export const COMPOSITION_PRESETS: CompositionPreset[] = [
  {
    id: 'single_glyph',
    name: 'Single Glyph Morph',
    description: 'One formation morphing O ⇄ I on the field drive',
    build: () => ({
      entities: [
        makeFormation({
          id: 'ent_main',
          name: 'Main',
          shape: { kind: 'glyph', text: 'O' },
          sequence: { ...DEFAULT_SEQUENCE, links: [makeLink({ kind: 'glyph', text: 'O' }), makeLink({ kind: 'glyph', text: 'I' })], advance: 'time', order: 'pingpong', hold: 0.2, transition: 3.8 },
        }),
      ],
      composition: { plane: 'vertical', orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: 'parallel' }, layoutName: 'Single formation' },
      cymatics: { enabled: false },
    }),
  },
  {
    id: 'chakra_body',
    name: 'Chakra Body · 7 centres',
    description: 'Seven yantra formations along the spine, each a vortex centre with its own tint',
    build: () => ({
      entities: makeChakraEntities('yantra'),
      composition: { plane: 'vertical', orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: 'parallel' }, entityTintWeight: 0.9, layoutName: 'Chakra Body' },
      cymatics: { enabled: false },
    }),
  },
  {
    id: 'kundalini_focus',
    name: 'Kundalini · travelling focus',
    description: 'Chakra body with a focus that climbs Root → Crown, carrying tint and cymatic station',
    build: () => ({
      entities: makeChakraEntities('yantra'),
      composition: { plane: 'vertical', orchestration: { mode: 'focus', order: 'reverse', dwell: 1.4, glide: 2.4, followStation: true, focusTintWeight: 0.6 }, entityTintWeight: 0.7, layoutName: 'Kundalini' },
      cymatics: { enabled: false },
    }),
  },
  {
    id: 'cymatic_plate',
    name: 'Cymatic Plate · resonator',
    description: 'Pure driven plate: geometry emerges from the resonator, sweep through the seven stations',
    build: () => ({
      entities: [makeFormation({ id: 'ent_medium', name: 'Medium', shape: { kind: 'glyph', text: '●' }, forces: { ...DEFAULT_FORCES, mode: 'none' }, tintWeight: 0 })],
      composition: { plane: 'horizontal', orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: 'parallel' }, layoutName: 'Cymatic plate' },
      cymatics: { enabled: true, dominance: 1.0, autoSweep: true, followFocus: false },
    }),
  },
  {
    id: 'chakra_cymatic',
    name: 'Chakra centres over a resonant plate',
    description: 'Seven tinted centres shaping a half-dominant cymatic medium; focus follows stations',
    build: () => ({
      entities: makeChakraEntities('yantra'),
      composition: { plane: 'vertical', orchestration: { mode: 'focus', order: 'reverse', dwell: 2, glide: 3, followStation: true, focusTintWeight: 0.5 }, entityTintWeight: 0.8, layoutName: 'Chakra × Cymatic' },
      cymatics: { enabled: true, dominance: 0.55, autoSweep: false, followFocus: true },
    }),
  },
];
