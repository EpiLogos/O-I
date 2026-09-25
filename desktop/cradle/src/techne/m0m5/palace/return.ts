/**
 * Palace Return (L5 Technē M5′, QL-MEF #218) — the Recognition/Return leg
 * that closes the canonical traversal back into M0′ ground.
 *
 * Laws carried here:
 *   - the Return routes a NATIVE owner Action (the reading's disclosed
 *     governed-write action, e.g. the TB0 specimen's `aikit.wiki.stage`);
 *     the adapter routes, the owner executes under its own authority — the
 *     Palace never mutates native state and never simulates a source change
 *     by changing its own décor;
 *   - a proposal the owner refuses (or that is not disclosed) routes to an
 *     explicit unrouted receipt and mutates NOTHING: no reading field, no
 *     composition, no bookmark changes (the rejected leg is provable);
 *   - after an accepted (routed) Return, the renewed ground is re-opened by
 *     crossing to the M0′ project aperture on the same DisclosureSession —
 *     subject, selection basis and agent session ride along untouched;
 *   - no stochastic identity; every input is a pure function of the reading
 *     and the composition.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { NativeActionRef, TechneActionRoute, TechneReading } from "../../contract.ts";
import type { PalaceComposition } from "./palace-state.ts";
import { arrangementOrder, palaceElements, type PalaceRegionSpec } from "./composition.ts";

/** The region-name stem the 3:3 expression floor composes under — matches
 * `regions.ts`'s own office label for the same facet, so a reader sees a
 * related name in each composed Scene's title as in the read-model region.
 * A region discloses exactly ONE contained Expression (composition.ts's
 * header finding: the kernel refuses an Entity subject bound to another
 * Expression, and a Scene has one body), so the reading's arranged Expression
 * refs each become their OWN region — never several members forced under one
 * region name. The exact diff against the live document (minting each
 * region's Scene ref, skipping what already matches) happens at execution
 * time (`kernelTechneAdapter.ts`, which alone holds the live snapshot) —
 * this module only names the INTENT: which Expression refs compose, in what
 * order. Never a `composition_set`/`shared.values` payload (a second store
 * in disguise) and never a bound-Entity subject. */
export const EXPRESSION_FLOOR_REGION = "Expression (3:3)";

/** The stable per-index region name for the 3:3 floor's Nth composed
 * Expression — deterministic, so re-deriving the same arrangement always
 * names the same regions (replay-idempotent at the naming layer too). */
export function expressionFloorRegionName(index: number): string {
  return `${EXPRESSION_FLOOR_REGION} ${index + 1}`;
}

/** The reading's disclosed Return action: the first action carrying
 * governed-write authority. Returns null when the reading discloses none —
 * an honest absence; the Palace then has no Return leg and says so. */
export function palaceReturnAction(reading: TechneReading): NativeActionRef | null {
  return (reading.actions ?? []).find((action) => action.authority === "governed-write") ?? null;
}

/** The shaped Return input: the composition's native refs in arrangement
 * order, the reading basis it derives from, and the region INTENT (never a
 * diffed change list — this module has no live document to diff against;
 * see composition.ts's `planRegions`/`composeRegions`, which the executing
 * adapter calls with the live snapshot). The owner's input schema governs;
 * this payload only ever carries verbatim refs and the basis they came
 * from. */
export interface PalaceReturnInput {
  summary: string;
  basis_ref: string;
  subject_ref: string;
  composed_refs: string[];
  /** The Palace's own anchor Expression — the current native Expression
   * open in the field (its Scenes carry the composed regions). Never a
   * minted or guessed ref: the first of the reading's own bound Expression
   * refs, in arrangement order — the same target the prior model used. */
  expression_ref: string | null;
  regions: PalaceRegionSpec[];
}

/** Shape the Return proposal from the composition. Returns null when there
 * is nothing to return (an unbound or empty composition) — no proposal is
 * invented. */
export function palaceReturnInput(reading: TechneReading, composition: PalaceComposition): PalaceReturnInput | null {
  if (!composition.bound) return null;
  const composedRefs: string[] = [];
  for (const region of composition.regions) {
    for (const entry of region.entries) {
      if (!composedRefs.includes(entry.ref)) composedRefs.push(entry.ref);
    }
  }
  if (composedRefs.length === 0) return null;
  const elements = palaceElements(reading);
  const present = new Set(elements.map((element) => element.expression_ref));
  const orderedRefs = arrangementOrder(composition.expressions).filter((ref) => present.has(ref));
  const memberRefs = orderedRefs.length > 0 ? orderedRefs : elements.map((element) => element.expression_ref);
  // One region per Expression ref — a region discloses exactly one member.
  const regions: PalaceRegionSpec[] = memberRefs.map((expression_ref, index) => {
    const element = elements.find((candidate) => candidate.expression_ref === expression_ref);
    return {
      name: expressionFloorRegionName(index),
      scene_ref: null,
      member: { expression_ref, title: expression_ref, revision: element?.revision ?? null },
    };
  });
  return {
    summary: `Palace integral composition of ${composedRefs.length} native refs over reading ${reading.reading_ref}`,
    basis_ref: reading.reading_ref,
    subject_ref: reading.subject.subject_ref,
    composed_refs: composedRefs,
    expression_ref: regions[0]?.member?.expression_ref ?? null,
    regions,
  };
}

/** The full Return route: the disclosed governed-write action plus the shaped
 * input. Null when the reading discloses no Return action or the composition
 * has nothing to return. */
export function palaceReturnRoute(reading: TechneReading, composition: PalaceComposition): TechneActionRoute | null {
  const action = palaceReturnAction(reading);
  const input = palaceReturnInput(reading, composition);
  if (!action || !input) return null;
  return {
    action_ref: action.action_ref,
    subject_ref: reading.subject.subject_ref,
    selection_ref: null,
    input,
  };
}

/** The M0′ aperture the renewed ground re-opens into: the project instrument
 * when the reading discloses it available, else null (honest absence — the
 * closure then stays in the palace with the receipt as its evidence). */
export function returnGroundInstrument(reading: TechneReading): "project" | null {
  const entry = reading.disclosure.instruments.find((candidate) => candidate.instrument === "project");
  return entry?.available ? "project" : null;
}

/** Re-open M0′ on the renewed ground — expressed as the crossing affordance
 * the surface performs through the shared session. Kept here so the closure
 * order (Return first, then re-open) is one testable function. */
export function returnCrossing(reading: TechneReading): { instrument: "project" } | null {
  const ground = returnGroundInstrument(reading);
  return ground ? { instrument: ground } : null;
}

/** The arrangement order of the 3:3 expression floor — re-exported for the
 * agent-state module so the walk order has exactly one definition. */
export function composedExpressionOrder(reading: TechneReading, composition: PalaceComposition): string[] {
  return arrangementOrder(composition.expressions).filter((ref) =>
    palaceElements(reading).some((element) => element.expression_ref === ref),
  );
}
