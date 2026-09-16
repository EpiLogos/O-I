/**
 * The M1′–M4′ embodiment gate (L5 Technē T7) — whether the shared Technē
 * selection can be embodied through the focused-instrument (M′) path, and
 * the descriptor the K9 registration consumes when it can.
 *
 * The gate: a subject is embodyable when its reading WARRANTS ql (M′
 * embodiment engages the harmonic/geometric depth) OR an Expression binding
 * exists (scene embodiment). When neither holds, the refusal is capability
 * honesty: the reason mirrors the reading's own disclosure for the conjugate
 * Expression reading
 * same way every unavailable instrument carries its reason.
 *
 * The descriptor names where embodiment would live —
 * `ql.techne:source:<subject_ref>` in the K9 focused-instrument registry —
 * and carries subject/source/coordinate refs verbatim. It is NOT a source:
 * the QL owner owns every fact an embodiment returns. `register.ts` wires
 * the descriptor to the owner's real FocusedInstrumentSource; nothing here
 * reconstructs an M state.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  validateReading,
  validateSelection,
  type DisclosureSelection,
  type TechneReading,
} from "../contract.ts";

/** The K9 selection-standing vocabulary, mapped through unchanged. */
export type TechneSelectionStanding = "current" | "field-advanced" | "stale";

/** What an embodiment would stand on — refs verbatim, or null where the
 * selection names none. Never a minted identity. */
export interface TechneEmbodySnapshot {
  subject_ref: string;
  source_ref: string | null;
  source_revision: string | null;
  coordinate_ref: string | null;
  reading_ref: string;
  snapshot_revision: string | null;
  selection_ref: string;
  expression_focus_ref: string | null;
}

/** FocusedInstrumentSource-compatible descriptor: the ref and title the K9
 * registry would carry, the selection standing mapped through unchanged, and
 * the snapshot basis above. */
export interface TechneFocusedInstrumentDescriptor {
  ref: string;
  title: string;
  selection_standing: TechneSelectionStanding | null;
  snapshot: TechneEmbodySnapshot;
}

export type TechneEmbody =
  | {embodyable: true; descriptor: TechneFocusedInstrumentDescriptor}
  | {embodyable: false; reason: string};

/**
 * The gate. Validate-then-produce (the cue's discipline): drifted inputs
 * raise; a subject that neither warrants ql nor binds an Expression returns
 * the honest not-embodyable reason instead of a descriptor.
 */
export function embody(reading: TechneReading, selection: DisclosureSelection): TechneEmbody {
  const readingCheck = validateReading(reading);
  if (!readingCheck.valid) throw new Error(`Technē embodiment refused: the reading drifted from the contract — ${readingCheck.errors.join("; ")}`);
  const selectionCheck = validateSelection(selection);
  if (!selectionCheck.valid) throw new Error(`Technē embodiment refused: the selection drifted from the contract — ${selectionCheck.errors.join("; ")}`);
  if (selection.subject_ref !== reading.subject.subject_ref) {
    throw new Error(`Technē embodiment refused: the selection names ${selection.subject_ref}, the reading discloses ${reading.subject.subject_ref} — one subject, one embodiment`);
  }

  const warranted = reading.ql !== undefined;
  const bound = (reading.expressions?.length ?? 0) > 0;
  if (!warranted && !bound) {
    const m1234 = reading.disclosure.instruments.find((entry) => entry.instrument === "expressions");
    const reason = m1234 && !m1234.available && m1234.reason
      ? m1234.reason
      : "no warranted QL facet and no Expression binding — nothing to embody";
    return {embodyable: false, reason};
  }

  const descriptor: TechneFocusedInstrumentDescriptor = {
    ref: `ql.techne:source:${reading.subject.subject_ref}`,
    title: `Technē · ${reading.subject.subject_ref}`,
    selection_standing: selection.selection_standing ?? null,
    snapshot: {
      subject_ref: reading.subject.subject_ref,
      source_ref: selection.source_ref ?? null,
      source_revision: selection.source_revision ?? null,
      coordinate_ref: selection.coordinate_ref ?? null,
      reading_ref: reading.reading_ref,
      snapshot_revision: selection.snapshot_revision ?? null,
      selection_ref: selection.selection_ref,
      expression_focus_ref: reading.expressions?.[0]?.scene_ref ?? null,
    },
  };
  return {embodyable: true, descriptor};
}
