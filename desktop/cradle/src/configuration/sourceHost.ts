/**
 * Which `ConfigPlaneSource` this build renders from.
 *
 * - dev / walk builds (`__CRADLE_WALK__`, baked by vite.config.ts): the
 *   LIVE binding, exactly as production — the fixture-backed world of
 *   `fixtureSource.ts` binds only with `?fixtures=1` (12-SETTINGS §5),
 *   clearly labelled on screen, for the generic-projection proofs.
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
import {detectTransport, kernelOp} from "../kernel/bridge";

declare const __CRADLE_WALK__: boolean;

let cached: Promise<ConfigPlaneSource> | null = null;

/** The live binding for walk builds that ask for it (`?config-source=live`):
 * the same source production binds, or null when no kernel transport is
 * reachable so the caller can fall back to the labelled fixture world. */
function bindLivePlaneSource(): Promise<ConfigPlaneSource | null> {
  const transport = detectTransport();
  if (transport.kind === "unavailable") return Promise.resolve(null);
  return import("./liveSource").then((module) =>
    module.createLiveConfigPlaneSource((op) => kernelOp(transport, op)),
  );
}

export function configPlaneSource(): Promise<ConfigPlaneSource> {
  if (!cached) {
    if (__CRADLE_WALK__) {
      // Walk builds may bind the LIVE plane explicitly (`?config-source=live`)
      // when a kernel transport is reachable — the acceptance floor's live
      // legs (HARNESS-SETTINGS-RESEARCH-2026-09-22 §4) then drive the same
      // engine production drives, through the same `liveSource` binding.
      // Without the parameter (or without a transport) the walk keeps the
      // clearly-labelled fixture world for the L6 descriptor-genericity
      // legs. A plain production build never reaches this branch.
      // 12-SETTINGS §5 (the v2 rule): live by default in walk builds too —
      // the fixture world binds ONLY when asked for (`?fixtures=1`). Without
      // a kernel transport the plane renders its honest absence.
      const wantsFixtures =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("fixtures") === "1";
      cached = wantsFixtures
        ? import("./fixtureSource").then((module) => module.createFixtureConfigPlaneSource())
        : bindLivePlaneSource().then((live) => live ?? createUnboundConfigPlaneSource(
            "no kernel transport is reachable; the configuration plane needs the Tauri host or a walk bridge",
          ));
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
 * registry emptying, one owner's outage, the L6 descriptor-genericity
 * section). Null in a production build. */
export interface FixtureWorldActions {
  simulateExternalNativeEdit(setting_ref: string, value: unknown): Promise<void>;
  setRegistryMode(mode: "full" | "empty"): void;
  setOwnerAvailability(owner_ref: string, state: "available" | "unavailable"): void;
  addFixtureSection(owner_ref: string): void;
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
      addFixtureSection: module.addFixtureSection,
    }));
  }
  return Promise.resolve(null);
}

// ---------------------------------------------------------------------------
// (The harness/chat face's fixture source is retired: the rebuilt settings
// sections read the machine's truth through the kernel ops —
// `systemDisclosure.systemDisclosureSource()` — or render their honest
// absence. No fixture variant exists for them.)
