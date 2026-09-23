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
export const FOCUSED_INSTRUMENT_RECIPE = "instrument.focused";

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

/** K9's foreground medium. This is presentation material only: one stable
 * O:I-owned production field with a fixed allocation and no domain catalogue.
 * The accepted K8 retained binding may take ownership of its attraction-target
 * textures; O:I continues to own the GPU simulation, rendering and lifecycle. */
const FOCUSED_INSTRUMENT_CONFIG: NativeConfig = (() => {
  const scene = blankScene("Focused living instrument");
  const medium = entity("Shared field", "·", { x: 0, y: 0, z: 0 });
  medium.id = "focused-medium";
  medium.size = { x: 1.55, y: 1.55 };
  medium.share = 1;
  scene.entities = [medium];
  scene.field.background = "#f4f2eb";
  scene.field.params.count = 65536;
  scene.field.params.size = 1.2;
  return nativeExport(scene).config;
})();

/** Stage material for a mark flight. The desktop opening splash does not
 * play this sequence. The mark first goes relational
 * (attractors on, orbits up) and swirls while still tethered; chaos then
 * takes over and the tether cuts — the cloud flies apart and keeps moving
 * for the whole flight. The release only opens the drift; it never fades
 * the material, so the particles stay fully alive until the final canvas
 * fade itself reveals the app. Offsets measure rendered simulation
 * progress, so loading or a suspended window cannot cut the flight short.
 * The choreography is authored stage material. Owner ruling 2026-09-17:
 * the field flies to its full extent and the background then fades
 * quickly and cleanly — no mid-flight dissolve. */
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

const WELCOME_RELEASE: NativeConfig = {
  fluid: { returnSpeed: 0, dispersion: 2.4 },
};

export const RECIPES: Readonly<Record<string, NativeConfig>> = Object.freeze({
  [MARK_RECIPE]: MARK_CONFIG,
  [FOCUSED_INSTRUMENT_RECIPE]: FOCUSED_INSTRUMENT_CONFIG,
  "welcome.relational": WELCOME_RELATIONAL,
  "welcome.chaos": WELCOME_CHAOS,
  "welcome.release": WELCOME_RELEASE,
});

export interface StageSequenceStep {
  /** Rendered simulation milliseconds from sequence start. */
  at: number;
  recipe: string;
  /** Optional central disperse strength fired with the step. */
  disperse?: number;
  /** Resolve a host palette at this scene boundary. */
  appearance?: "host" | "inverse-host";
}

export interface StageSequence {
  steps: readonly StageSequenceStep[];
  /** Successfully rendered simulation time, never a wall-clock timeout. */
  duration: number;
  /** The same field/background becomes transparent after the flight. */
  fadeOutFrom?: number;
}

export const SEQUENCES: Readonly<Record<string, StageSequence>> = Object.freeze({
  "welcome.enter": Object.freeze({
    duration: 3400,
    fadeOutFrom: 2900,
    steps: Object.freeze([
      Object.freeze({ at: 0, recipe: "welcome.relational", disperse: 1.4, appearance: "host" as const }),
      Object.freeze({ at: 1000, recipe: "welcome.chaos", disperse: 2.6 }),
      Object.freeze({ at: 2900, recipe: "welcome.release" }),
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
