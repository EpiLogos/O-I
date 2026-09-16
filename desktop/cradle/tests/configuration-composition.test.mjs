/**
 * The settings × composition interface (`src/configuration/composition.ts`)
 * against the live source's pass-through: proves the law of
 * CONTEXT-FRAME-COMPOSITION-LOCK §5/§7 at the surface — an owner standing
 * outside the effective composition is disclosure-only, a failed world
 * reading leaves standings unknown, and the composition facts cross the
 * live binding verbatim. No React, no product branches.
 *
 * Run: node --test tests/configuration-composition.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { settingsActionable, compositionLine } from "../src/configuration/composition.ts";
import { createLiveConfigPlaneSource } from "../src/configuration/liveSource.ts";

const MOUNT = (overrides = {}) => ({
  owner_ref: "ai-kit",
  document: { sections: [{ id: "resolution", settings: [] }] },
  availability: { state: "available", reason: null },
  error: null,
  ...overrides,
});

test("only an in-composition, available mount renders actionable settings", () => {
  assert.equal(settingsActionable(MOUNT({ composition: { standing: "in_composition", position: 2 } })), true,
    "present owner, available: its settings are the owner's own to operate");
  // Outside the effective composition: disclosure only, never controls —
  // recognition precedes mutation (lock §7).
  assert.equal(settingsActionable(MOUNT({ composition: { standing: "absent", position: 4 } })), false);
  // A failed world reading invents nothing: unknown standing is not actionable.
  assert.equal(settingsActionable(MOUNT({ composition: { standing: "unknown", position: 2 } })), false);
  assert.equal(settingsActionable(MOUNT({ composition: null })), false, "a mount without a composition fact is unknown, never assumed");
  assert.equal(settingsActionable(MOUNT({ composition: { standing: "in_composition" }, availability: { state: "unavailable", reason: "x" } })), false,
    "standing does not override the owner's own availability probe");
  assert.equal(settingsActionable(MOUNT({ composition: { standing: "unpositioned", position: null } })), true,
    "oi and connector owners hold no product position and stand inside the world");
});

test("the composition line names the mode, its basis and any requested mode", () => {
  assert.equal(
    compositionLine({ requested_mode: null, install_mode: "0/1/2", install_mode_basis: "effective", present_positions: [0, 1, 2], warnings: [] }),
    "Effective composition: mode 0/1/2 (effective) — present positions [0,1,2]",
  );
  assert.equal(
    compositionLine({ requested_mode: "0/1/2", install_mode: "0/1/2", install_mode_basis: "requested", present_positions: [0, 1], warnings: [] }),
    "Effective composition: mode 0/1/2 (requested) — requested 0/1/2 — present positions [0,1]",
    "requested and effective stay distinct: the basis names which one is speaking",
  );
  assert.equal(
    compositionLine({ requested_mode: null, install_mode: null, install_mode_basis: null, present_positions: [], warnings: [] }),
    "Effective composition: mode explicit selection — present positions []",
    "arbitrary selections are disclosed exactly as they are, never forced into a mode",
  );
  assert.equal(
    compositionLine({ requested_mode: null, install_mode: null, install_mode_basis: null, present_positions: [], warnings: [], error: "the reading failed" }),
    "Composition unavailable: the reading failed",
  );
  assert.equal(compositionLine(null), null);
});

test("the live source passes the composition facts through verbatim", async () => {
  const reading = {
    schema: "oi.cradle.config-registry/v1",
    observed_at_unix_ms: 7,
    composition: {
      requested_mode: "0/1/2",
      install_mode: "0/1/2",
      install_mode_basis: "requested",
      present_positions: [0, 1],
      warnings: ["Requested install mode 0/1/2 is not fully realised: AIKit is not usable in the effective composition."],
    },
    mounts: [
      MOUNT({ owner_ref: "central", composition: { standing: "in_composition", position: 0 } }),
      MOUNT({ owner_ref: "ai-kit", composition: { standing: "absent", position: 2 } }),
    ],
  };
  const source = createLiveConfigPlaneSource(async (op) => {
    assert.equal(op.op, "config_registry_read");
    return { outcome: { result: "config_registry_reading", reading } };
  });
  const registry = await source.readRegistry();
  assert.equal(registry.composition.requested_mode, "0/1/2");
  assert.deepEqual(registry.composition.present_positions, [0, 1]);
  assert.equal(
    registry.composition.warnings[0],
    reading.composition.warnings[0],
    "the reading's own shortfall warning crosses verbatim (lock §5: the request keeps naming the world, degraded)",
  );
  assert.equal(registry.mounts[1].composition.standing, "absent");
});

test("a kernel predating the disclosure renders the honest unknown", async () => {
  const source = createLiveConfigPlaneSource(async () => ({
    outcome: {
      result: "config_registry_reading",
      reading: { schema: "oi.cradle.config-registry/v1", observed_at_unix_ms: 7, mounts: [MOUNT()] },
    },
  }));
  const registry = await source.readRegistry();
  assert.equal(registry.composition, null);
  assert.equal(settingsActionable(registry.mounts[0]), false,
    "without a composition fact nothing is rendered actionable");
});
