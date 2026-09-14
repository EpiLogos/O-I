/**
 * Authored recipes: the named visual material and scene sequences the
 * stage may present. This module is the boundary the Global Expression
 * Stage draws — application code names a recipe ("oi.mark") or a sequence
 * ("welcome.enter"); it never writes physics. When the upgraded native
 * engine lands, these entries become authored Expressions/scenes and the
 * stage's contract (cue → recipe identity) does not change.
 */
import type { PointCloudPatch } from "@epilogos/oi-design-system/point-cloud/config";
import logoState from "../visuals/oi-logo-state.json";

export const MARK_RECIPE = "oi.mark";

const MARK_CONFIG: PointCloudPatch = (logoState as unknown as { config: PointCloudPatch }).config;

/** The opening flight, in two stages: the mark first goes relational
 * (attractors on, orbits up) and starts to swirl while still tethered;
 * ~half a second later chaos takes over and the tether cuts — the cloud
 * flies apart as the app takes over. (Moved verbatim from the bespoke
 * WelcomeField patches: the choreography is now authored material, not
 * React changing physics parameters.) */
const WELCOME_RELATIONAL: PointCloudPatch = {
  fluid: {
    turbulence: 1.3,
    curlSpeed: 1.0,
    dispersion: 0.7,
    returnSpeed: 1.3,
    viscosity: 0.965,
  },
  relational: {
    enabled: true,
    mode: "orbital",
    attractorCount: 3,
    attractorGravity: 2.4,
    orbitSpeed: 2.6,
    orbitRadius: 300,
    relationalSpin: 2.4,
    chaosFactor: 0.8,
    wanderSpeed: 1.4,
  },
  autoMorph: false,
  morphProgress: 1,
};

const WELCOME_CHAOS: PointCloudPatch = {
  fluid: {
    turbulence: 2.0,
    curlSpeed: 1.4,
    dispersion: 1.6,
    returnSpeed: 0.15,
    viscosity: 0.98,
  },
  relational: {
    mode: "chaos",
    attractorGravity: 3.2,
    orbitSpeed: 3.2,
    orbitRadius: 460,
    relationalSpin: 3.0,
    chaosFactor: 3.2,
    wanderSpeed: 2.4,
  },
};

export const RECIPES: Readonly<Record<string, PointCloudPatch>> = Object.freeze({
  [MARK_RECIPE]: MARK_CONFIG,
  "welcome.relational": WELCOME_RELATIONAL,
  "welcome.chaos": WELCOME_CHAOS,
});

export interface StageSequenceStep {
  /** Offset from sequence start, in milliseconds. */
  at: number;
  recipe: string;
  /** Optional central disperse strength fired with the step. */
  disperse?: number;
}

export interface StageSequence {
  steps: readonly StageSequenceStep[];
}

export const SEQUENCES: Readonly<Record<string, StageSequence>> = Object.freeze({
  "welcome.enter": Object.freeze({
    steps: Object.freeze([
      Object.freeze({ at: 0, recipe: "welcome.relational", disperse: 1.4 }),
      Object.freeze({ at: 472, recipe: "welcome.chaos", disperse: 2.6 }),
    ]),
  }),
});

export function stageRecipe(id: string): PointCloudPatch {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error(`Unknown stage recipe: ${id}`);
  return recipe;
}

export function stageSequence(id: string): StageSequence {
  const sequence = SEQUENCES[id];
  if (!sequence) throw new Error(`Unknown stage sequence: ${id}`);
  return sequence;
}
