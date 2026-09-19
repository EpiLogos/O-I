/**
 * The M2′ standing grammar (QL-MEF #215) — how a relation's epistemic
 * standing becomes a VISUAL class without ever upgrading it.
 *
 * The law (#215 §5): sourced fact, source-reported claim, inferred/derived
 * relation, user-authored hypothesis, disputed relation and
 * unavailable/unknown standing must stay visually and structurally distinct,
 * and no animation, lane placement or edge strength may silently upgrade a
 * relation's standing. This module is the whole of that grammar, and it is
 * mechanical: it reads ONLY the owner-supplied fields (standing, source_ref,
 * evidence_refs, derivation_ref, origin) and maps them to a coarse visual
 * class. The owner's verbatim standing string always rides alongside and is
 * always what the surface displays — the class only chooses the stroke.
 *
 * The mapping is deliberately conservative (first match wins, never upgrades):
 *   disputed keywords          -> "disputed"
 *   mythic keywords            -> "mythic"
 *   derivation_ref present or
 *   interpretation keywords    -> "derived"   (an interpretation stays
 *                                interpreted even when it cites a source)
 *   source_ref or evidence     -> "sourced"
 *   a standing with no source  -> "authored"  (the owner's own assertion)
 *   nothing disclosed          -> "unavailable" (standing unknown — shown as
 *                                unknown, never guessed)
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechneWholeRelation } from "../../contract.ts";

/** The coarse visual classes. Presentation only — the verbatim standing is
 * the datum; this only chooses how an edge is drawn. */
export type StandingVisual =
  | "sourced"
  | "derived"
  | "authored"
  | "disputed"
  | "mythic"
  | "unavailable";

export interface StandingReading {
  /** The visual class the edge is drawn with. */
  visual: StandingVisual;
  /** The owner's verbatim standing, or null when none was disclosed. */
  verbatim: string | null;
  /** The mechanical reason the class was chosen — surfaced in tooltips so
   * the mapping is explicit, never silent. */
  rule: string;
}

const DISPUTED = /disput|alleg|contested|unverified|refuted|challenged|rumour|rumor/i;
const MYTHIC = /myth|legend|folklore/i;
const INTERPRETIVE = /interpret|infer|deriv|hypothes|speculat|conjectur|assess/i;

/**
 * The standing reading of one relation. Reads only owner-supplied fields;
 * `origin` never upgrades a relation (an observed origin with no disclosed
 * standing still shows standing unknown).
 */
export function standingOf(relation: Pick<TechneWholeRelation, "standing" | "source_ref" | "evidence_refs" | "derivation_ref">): StandingReading {
  const verbatim = relation.standing ?? null;
  if (verbatim !== null && DISPUTED.test(verbatim)) {
    return { visual: "disputed", verbatim, rule: `standing "${verbatim}" names a disputed/alleged claim` };
  }
  if (verbatim !== null && MYTHIC.test(verbatim)) {
    return { visual: "mythic", verbatim, rule: `standing "${verbatim}" names mythic material` };
  }
  if (relation.derivation_ref != null) {
    return { visual: "derived", verbatim, rule: `the owner supplies a derivation ref (${relation.derivation_ref}) — shown as derived even when a source is cited` };
  }
  if (verbatim !== null && INTERPRETIVE.test(verbatim)) {
    return { visual: "derived", verbatim, rule: `standing "${verbatim}" names interpretation/inference — a cited source does not upgrade it to fact` };
  }
  const evidenced = (relation.evidence_refs?.length ?? 0) > 0 || relation.source_ref != null;
  if (evidenced) {
    return { visual: "sourced", verbatim, rule: `a source or evidence ref is disclosed${verbatim ? ` (standing "${verbatim}")` : ""}` };
  }
  if (verbatim !== null) {
    return { visual: "authored", verbatim, rule: `standing "${verbatim}" is disclosed with no source or evidence ref — the owner's own assertion` };
  }
  return { visual: "unavailable", verbatim: null, rule: "the owner discloses no standing, source or evidence for this relation — standing unknown, never guessed" };
}

/** The legend the surface renders whenever relations are shown: the visual
 * encoding is explicit, never silent. */
export const STANDING_LEGEND: readonly { visual: StandingVisual; label: string; description: string }[] = [
  { visual: "sourced", label: "sourced", description: "a source or evidence ref is disclosed; the owner's standing string rides verbatim" },
  { visual: "derived", label: "derived / interpreted", description: "the owner supplies a derivation ref or names the standing interpretive — a cited source does not upgrade it" },
  { visual: "authored", label: "authored", description: "an owner-asserted standing with no source or evidence ref" },
  { visual: "disputed", label: "disputed", description: "the owner's standing names a disputed or alleged claim" },
  { visual: "mythic", label: "mythic", description: "the owner's standing names mythic material" },
  { visual: "unavailable", label: "standing unknown", description: "no standing, source or evidence disclosed — shown as unknown, never guessed" },
];
