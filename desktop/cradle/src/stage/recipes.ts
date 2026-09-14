/**
 * Authored recipes: the named visual material and scene sequences the
 * stage may present. This module is the boundary the Global Expression
 * Stage draws — application code names a recipe ("oi.mark") or a sequence
 * ("welcome.enter"); it never writes physics. The mark is authored
 * directly in the engine's own scene schema (two formations on the shared
 * medium); the flight steps are overlay patches on its retained config.
 */
import { blankScene, entity } from "@epilogos/oi-design-system/expressions-engine/shell/model.mjs";
import { nativeExport, type NativeConfig } from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";

export const MARK_RECIPE = "oi.mark";

/** The authored mark: O and I as two formations, proportioned like the
 * instrument's own field-studies opening — the large O and the narrow I
 * sharing one medium at 120,000 particles, ink on paper. */
const MARK_CONFIG: NativeConfig = (() => {
  const scene = blankScene("O:I mark");
  const o = entity("O — opening", "O", { x: -0.22, y: 0.03, z: 0 });
  o.id = "mark-o";
  o.size = { x: 1.43, y: 1.63 };
  o.rotation = -5;
  o.share = 4;
  const i = entity("I — interval", "I", { x: 0.66, y: 0.015, z: 0 });
  i.id = "mark-i";
  i.size = { x: 0.28, y: 1.62 };
  i.share = 1;
  scene.entities = [o, i];
  scene.field.background = "#f4f2eb";
  scene.field.params.count = 120000;
  scene.field.params.size = 1.6;
  return nativeExport(scene).config;
})();

/** The opening flight, in two stages: the mark first goes relational
 * (attractors on, orbits up) and starts to swirl while still tethered;
 * ~half a second later chaos takes over and the tether cuts — the cloud
 * flies apart as the app takes over. (Moved verbatim from the bespoke
 * WelcomeField patches: the choreography is now authored material, not
 * React changing physics parameters.) */
const WELCOME_RELATIONAL: NativeConfig = {
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

const WELCOME_CHAOS: NativeConfig = {
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

/** A short, bounded arrangement disclosure on the shared native medium.
 * Three formations gather around the central encounter; no node represents
 * an Agent, Run, authority or completion percentage. */
const FACTORY_GATHER: NativeConfig = (() => {
  const scene = blankScene("Factory arrangement");
  scene.entities = [-0.8, 0, 0.8].map((x, index) => {
    const form = entity("Shell region", "O", {x, y: 0, z: 0});
    form.id = `factory-region-${index}`;
    form.size = {x: index === 1 ? 0.44 : 0.16, y: index === 1 ? 0.44 : 0.16};
    form.share = index === 1 ? 3 : 1;
    return form;
  });
  scene.field.params.count = 6000;
  scene.field.params.size = 1.1;
  return nativeExport(scene).config;
})();

export const RECIPES: Readonly<Record<string, NativeConfig>> = Object.freeze({
  [MARK_RECIPE]: MARK_CONFIG,
  "factory.gather": FACTORY_GATHER,
  "factory.settle": {fluid: {dispersion: 0.1, returnSpeed: 2.0}},
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
  "factory.enter": Object.freeze({steps: Object.freeze([{at: 0, recipe: "factory.gather"}, {at: 180, recipe: "factory.settle"}])}),
  "welcome.enter": Object.freeze({
    steps: Object.freeze([
      Object.freeze({ at: 0, recipe: "welcome.relational", disperse: 1.4 }),
      Object.freeze({ at: 472, recipe: "welcome.chaos", disperse: 2.6 }),
    ]),
  }),
});

export function stageRecipe(id: string): NativeConfig {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error(`Unknown stage recipe: ${id}`);
  return recipe;
}

export function stageSequence(id: string): StageSequence {
  const sequence = SEQUENCES[id];
  if (!sequence) throw new Error(`Unknown stage sequence: ${id}`);
  return sequence;
}
