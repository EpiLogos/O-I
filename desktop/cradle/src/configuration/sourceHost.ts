/**
 * Which `ConfigPlaneSource` this build renders from.
 *
 * - dev / walk builds (`__CRADLE_WALK__`, baked by vite.config.ts): the
 *   fixture-backed world of `fixtureSource.ts`, clearly labelled on
 *   screen. This is where the configuration walk scenario proves the §21
 *   acceptance against the frozen fixtures.
 * - production: unbound. The live KernelOp binding (documented in
 *   `source.ts`) is the integrator's convergence work; until it lands the
 *   configuration plane renders its absence honestly — never a fake
 *   control, never fixture data dressed as the machine's truth.
 *
 * Both gates use the same statement form as the Cradle walk gate
 * (`src/Cradle.tsx`): in a plain production build `__CRADLE_WALK__` bakes
 * to `false`, the dev branch is dead-code eliminated, and the
 * fixture-world chunk (the only holder of the fixture-world strings) is
 * never emitted.
 */
import type {ConfigPlaneSource} from "./source";
import {createUnboundConfigPlaneSource} from "./source";

declare const __CRADLE_WALK__: boolean;

let cached: Promise<ConfigPlaneSource> | null = null;

export function configPlaneSource(): Promise<ConfigPlaneSource> {
  if (!cached) {
    if (__CRADLE_WALK__) {
      cached = import("./fixtureSource").then((module) => module.createFixtureConfigPlaneSource());
    } else {
      cached = Promise.resolve(createUnboundConfigPlaneSource(
        "the live configuration-plane binding (KernelOp → oi kernel) lands at #299 Gate B convergence",
      ));
    }
  }
  return cached;
}

/** The dev-only fixture-world simulation surface (external native edits,
 * registry emptying). Null in a production build. */
export interface FixtureWorldActions {
  simulateExternalNativeEdit(setting_ref: string, value: unknown): Promise<void>;
  setRegistryMode(mode: "full" | "empty"): void;
}

export function fixtureWorld(): Promise<FixtureWorldActions | null> {
  if (__CRADLE_WALK__) {
    return import("./fixtureSource").then((module) => ({
      simulateExternalNativeEdit: (setting_ref: string, value: unknown) => {
        const source = cached ?? configPlaneSource();
        return source.then((planeSource) => module.simulateExternalNativeEdit(planeSource, setting_ref, value));
      },
      setRegistryMode: module.setRegistryMode,
    }));
  }
  return Promise.resolve(null);
}
