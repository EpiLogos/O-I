/**
 * Which `ConfigPlaneSource` this build renders from.
 *
 * - dev / walk builds (`__CRADLE_WALK__`, baked by vite.config.ts): the
 *   fixture-backed world of `fixtureSource.ts`, clearly labelled on
 *   screen. This is where the configuration walk scenario proves the §21
 *   acceptance against the frozen fixtures.
 * - production: the LIVE binding (`liveSource.ts`) — the typed
 *   configuration `KernelOp`s routed to the same engine `oi config` /
 *   `oi profile` drive. Where no kernel transport exists at all (a plain
 *   browser, no Tauri host, no walk bridge) the plane renders its absence
 *   honestly instead — never a fake control, never fixture data dressed
 *   as the machine's truth.
 *
 * The walk gate uses the same statement form as the Cradle walk gate
 * (`src/Cradle.tsx`): in a plain production build `__CRADLE_WALK__` bakes
 * to `false`, the dev branch is dead-code eliminated, and the
 * fixture-world chunk (the only holder of the fixture-world strings) is
 * never emitted.
 */
import type {ConfigPlaneSource} from "./source";
import {createUnboundConfigPlaneSource} from "./source";
import type {HarnessSource} from "./harnessSource";
import {createUnboundHarnessSource} from "./harnessSource";
import {detectTransport, kernelOp} from "../kernel/bridge";

declare const __CRADLE_WALK__: boolean;

let cached: Promise<ConfigPlaneSource> | null = null;

export function configPlaneSource(): Promise<ConfigPlaneSource> {
  if (!cached) {
    if (__CRADLE_WALK__) {
      cached = import("./fixtureSource").then((module) => module.createFixtureConfigPlaneSource());
    } else {
      const transport = detectTransport();
      if (transport.kind === "unavailable") {
        cached = Promise.resolve(createUnboundConfigPlaneSource(
          `no kernel transport is reachable (${transport.reason}); the configuration plane needs the Tauri host`,
        ));
      } else {
        cached = import("./liveSource").then((module) =>
          module.createLiveConfigPlaneSource((op) => kernelOp(transport, op)),
        );
      }
    }
  }
  return cached;
}

/** The dev-only fixture-world simulation surface (external native edits,
 * registry emptying, one owner's outage). Null in a production build. */
export interface FixtureWorldActions {
  simulateExternalNativeEdit(setting_ref: string, value: unknown): Promise<void>;
  setRegistryMode(mode: "full" | "empty"): void;
  setOwnerAvailability(owner_ref: string, state: "available" | "unavailable"): void;
}

export function fixtureWorld(): Promise<FixtureWorldActions | null> {
  if (__CRADLE_WALK__) {
    return import("./fixtureSource").then((module) => ({
      simulateExternalNativeEdit: (setting_ref: string, value: unknown) => {
        const source = cached ?? configPlaneSource();
        return source.then((planeSource) => module.simulateExternalNativeEdit(planeSource, setting_ref, value));
      },
      setRegistryMode: module.setRegistryMode,
      setOwnerAvailability: module.setOwnerAvailability,
    }));
  }
  return Promise.resolve(null);
}

// ---------------------------------------------------------------------------
// the harness/chat face's source (same gate, same honest absence)

let harnessCached: Promise<HarnessSource> | null = null;

/** Which `HarnessSource` this build renders the "Chat & harnesses" panel
 * from — the same walk/production gate as `configPlaneSource`: fixture in
 * dev/walk builds (labelled on screen), the live kernel binding in
 * production, and the honest absence where no kernel transport exists. */
export function harnessPlaneSource(): Promise<HarnessSource> {
  if (!harnessCached) {
    if (__CRADLE_WALK__) {
      harnessCached = import("./harnessFixture").then((module) => module.createFixtureHarnessSource());
    } else {
      const transport = detectTransport();
      if (transport.kind === "unavailable") {
        harnessCached = Promise.resolve(createUnboundHarnessSource(
          `no kernel transport is reachable (${transport.reason}); the harness face needs the Tauri host`,
        ));
      } else {
        harnessCached = import("./harnessSource").then((module) =>
          module.createLiveHarnessSource((op) => kernelOp(transport, op)),
        );
      }
    }
  }
  return harnessCached;
}
