import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyActivation,
  defineSurfaceContribution,
  proveLifecycle,
  stageSurfaceContribution,
  SURFACE_CONTRIBUTION_ID,
  SURFACE_REFS,
} from "../contrib/lib/component-surface.ts";

test("the contribution declares stable identity, provider and provenance", () => {
  const definition = defineSurfaceContribution();
  assert.equal(definition.version, "aikit.session-space-contribution/v1");
  assert.equal(definition.id, SURFACE_CONTRIBUTION_ID);
  assert.equal(definition.provider, "provider/oi/pi-surface");
  assert.ok(definition.surface_refs.length > 0);
  assert.ok(definition.provenance.length > 0);
});

test("staging is write-free and inspects the SessionSpace view before activation", () => {
  const staged = stageSurfaceContribution();
  assert.equal(staged.preview.version, "aikit.session-space/v1");
  assert.equal(staged.preview.lifecycle, "open");
  assert.deepEqual(
    staged.preview.surfaces.map((s) => s.surface),
    [...SURFACE_REFS],
  );
  for (const surface of staged.preview.surfaces) {
    assert.notEqual(surface.state, "active", "staging must not claim activation");
  }
});

test("a visible surface does not imply activation authority", () => {
  const contribution = defineSurfaceContribution();
  const eligible = classifyActivation(
    { activeRefs: [], selectedRefs: [], withheldRefs: [], removedRefs: [], provenance: [] },
    contribution,
  );
  assert.equal(eligible.state, "eligible");

  // Selected-for-projection is still not active.
  const selected = classifyActivation(
    { activeRefs: [], selectedRefs: [...SURFACE_REFS], withheldRefs: [], removedRefs: [], provenance: [] },
    contribution,
  );
  assert.equal(selected.state, "selected");
});

test("activation is only reported from provider observation", () => {
  const contribution = defineSurfaceContribution();
  const active = classifyActivation(
    { activeRefs: [...SURFACE_REFS], selectedRefs: [], withheldRefs: [], removedRefs: [], provenance: [] },
    contribution,
  );
  assert.equal(active.state, "active");
});

test("withholding and removal are distinguished from activation", () => {
  const contribution = defineSurfaceContribution();
  const withheld = classifyActivation(
    { activeRefs: [], selectedRefs: [], withheldRefs: [...SURFACE_REFS], removedRefs: [], provenance: [] },
    contribution,
  );
  assert.equal(withheld.state, "withheld");
  const removed = classifyActivation(
    { activeRefs: [], selectedRefs: [], withheldRefs: [], removedRefs: [...SURFACE_REFS], provenance: [] },
    contribution,
  );
  assert.equal(removed.state, "removed");
});

test("lifecycle proof covers discovery, preview and observed state", () => {
  const proof = proveLifecycle({
    activeRefs: [],
    selectedRefs: [],
    withheldRefs: [],
    removedRefs: [],
    provenance: ["aikit status --json"],
  });
  const states = proof.map((p) => p.state);
  assert.ok(states.includes("discovered"));
  assert.ok(states.includes("staged"));
  assert.ok(states.includes("previewed"));
  assert.ok(states.includes("eligible"));
  for (const entry of proof) {
    assert.equal(entry.authority.includes("provider"), true);
  }
});
