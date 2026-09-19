/**
 * The M0′–M5′ lens definitions (T3, 2026-09-19) — the pure, node-testable
 * half of the six Technē lenses: identity (instrument, M′ office, label,
 * glyph) and standing — availability from the subject's CURRENT
 * TechneDisclosureState with the reading's own reason when unavailable
 * (the QL-MEF registry law: composition, never capability; owner wayfinder
 * §13, §21). The React bodies are attached by `../instrumentLenses.ts`,
 * which registers the six through the parent seam (lensMount.ts).
 *
 * Standing maps the four disclosure states (§21): with no reading standing
 * (no-subject / reading-in-flight) the lens stays discoverable — the CHOOSER
 * shows it, the BODY renders the honest NO SUBJECT / LOADING state; once a
 * reading stands, its own disclosure entry governs: unavailable carries the
 * reading's reason verbatim; available mounts immediately.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {TechneLens} from "../lensMount";
import {deepInstrument} from "../instruments";
import {instrumentStanding, type TechneDisclosureState} from "../techneReading";

/** The six lenses of the Technē mode, in M′ order. */
export const M0M5_LENSES = ["project", "canvas", "timeline", "journey", "place", "palace"] as const;
export type M0M5LensId = (typeof M0M5_LENSES)[number];

/** One lens minus its React body — everything `node --test` can prove. The
 * instrument id narrows to the six M′ lenses (never "expressions", which is
 * the conjugate 3:3 reading on the Expressions side, not a lens here). */
export type M0M5LensDef = Omit<TechneLens, "Body" | "instrument"> & {instrument: M0M5LensId};

/** The standing function every M′ lens carries: the disclosure's own entry
 * for this instrument, reasons verbatim, never simulated. */
export function m0m5LensStanding(instrument: M0M5LensId, disclosure: TechneDisclosureState): {available: boolean; reason?: string} {
  const standing = instrumentStanding(disclosure, instrument);
  if (standing.available) return {available: true};
  return {available: false, reason: standing.reason ?? `the reading does not disclose ${instrument} as available`};
}

/** The six lens definitions, M′0 → M′5. */
export function m0m5LensDefs(): M0M5LensDef[] {
  return M0M5_LENSES.map((instrument) => {
    const meta = deepInstrument(instrument);
    if (!meta) throw new Error(`no deep-instrument vocabulary entry for ${instrument}`);
    return {
      instrument: meta.instrument as M0M5LensId,
      mPrime: meta.mPrime,
      label: meta.label,
      glyph: meta.glyph,
      standing: (disclosure: TechneDisclosureState) => m0m5LensStanding(instrument, disclosure),
    } satisfies M0M5LensDef;
  });
}
