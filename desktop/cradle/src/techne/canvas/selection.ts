/**
 * The Canvas/Constellation selection model (L5 Technē T2) — the pure click
 * model from a constellation interaction to a contract-checked
 * DisclosureSelection. Nothing here touches a store; the surface hands the
 * produced selection to `disclosureSession.setSelection`, and open-in-
 * instrument transitions go through `disclosureSession.openInInstrument`.
 *
 * The laws this model keeps (QL-MEF wayfinder §3–§5):
 *   - the subject stays the reading's subject — a member, relation or whole
 *     click refocuses the SAME disclosure, it never moves the session to a
 *     new subject, so every instrument stays co-referenced;
 *   - focus_refs carry the clicked member ref(s) — the relation's two
 *     endpoints for a relation click;
 *   - selection_ref is derived stably from the subject and the focus path:
 *       member  → `ql.techne:selection:<subject_ref>:<member_ref>`
 *       whole   → `ql.techne:selection:<subject_ref>:<whole_ref>`
 *       relation→ `ql.techne:selection:<subject_ref>:<from_ref>~<relation>~<to_ref>`
 *     (native refs ride inside verbatim; the `~` form distinguishes a
 *     relation click from a member click on the same refs);
 *   - the source basis (source_ref, revisions, disclosure/coordinate refs,
 *     agent_session_ref, standing) is carried over from the current
 *     selection — every hop preserves subject, source basis and selection;
 *   - the result is validated against the contract before it is returned;
 *     drift is a bug, refused here rather than rendered.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  validateSelection,
  type DisclosureSelection,
  type TechneReading,
  type TechneWholeRelation,
} from "../contract.ts";

const SELECTION_REF_PREFIX = "ql.techne:selection";

export function memberSelectionRef(subjectRef: string, memberRef: string): string {
  return `${SELECTION_REF_PREFIX}:${subjectRef}:${memberRef}`;
}

export function relationSelectionRef(subjectRef: string, relation: TechneWholeRelation): string {
  return `${SELECTION_REF_PREFIX}:${subjectRef}:${relation.from_ref}~${relation.relation}~${relation.to_ref}`;
}

export function wholeSelectionRef(subjectRef: string, wholeRef: string): string {
  return `${SELECTION_REF_PREFIX}:${subjectRef}:${wholeRef}`;
}

/**
 * Build one refocused selection: the reading's subject and reading basis,
 * the canvas instrument, the given focus and derived ref; the source basis
 * carried verbatim from the current selection (or from the reading's own
 * snapshot when none is open yet). Contract-checked before it returns.
 */
function refocusedSelection(
  reading: TechneReading,
  current: DisclosureSelection | null,
  focusRefs: string[],
  selectionRef: string,
): DisclosureSelection {
  const selection: DisclosureSelection = {
    selection_ref: selectionRef,
    subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref,
    instrument: "canvas",
    focus_refs: focusRefs,
  };
  if (current) {
    if (current.source_ref) selection.source_ref = current.source_ref;
    if (current.source_revision) selection.source_revision = current.source_revision;
    if (current.disclosure_ref) selection.disclosure_ref = current.disclosure_ref;
    if (current.coordinate_ref) selection.coordinate_ref = current.coordinate_ref;
    if (current.agent_session_ref) selection.agent_session_ref = current.agent_session_ref;
    if (current.selection_standing) selection.selection_standing = current.selection_standing;
  }
  const snapshotRevision = current?.snapshot_revision ?? reading.snapshot?.revision;
  if (snapshotRevision) selection.snapshot_revision = snapshotRevision;
  const checked = validateSelection(selection);
  if (!checked.valid) throw new Error(`Canvas selection drifted from the contract: ${checked.errors.join("; ")}`);
  return selection;
}

/** Clicking a member (or the QL address anchor): focus is that ref alone. */
export function memberSelection(reading: TechneReading, current: DisclosureSelection | null, memberRef: string): DisclosureSelection {
  if (!memberRef.trim()) throw new Error("Canvas member selection needs a member ref");
  return refocusedSelection(reading, current, [memberRef], memberSelectionRef(reading.subject.subject_ref, memberRef));
}

/** Clicking a typed relation: focus is its two endpoints (one when they
 * coincide); the provider's relation vocabulary rides only in the derived
 * selection_ref, never replacing a native ref. */
export function relationSelection(reading: TechneReading, current: DisclosureSelection | null, relation: TechneWholeRelation): DisclosureSelection {
  if (!relation.relation?.trim() || !relation.from_ref?.trim() || !relation.to_ref?.trim()) {
    throw new Error("Canvas relation selection needs a relation with from_ref and to_ref");
  }
  const focusRefs = relation.from_ref === relation.to_ref ? [relation.from_ref] : [relation.from_ref, relation.to_ref];
  return refocusedSelection(reading, current, focusRefs, relationSelectionRef(reading.subject.subject_ref, relation));
}

/**
 * The leaf→whole hop: focus the bounded whole within the SAME disclosure.
 * The subject and reading basis do not move — this is navigation inside one
 * reading, so the session before and after stays co-referenced
 * (`coReferenced(before, after) === true`). Refused when the reading
 * discloses no whole.
 */
export function wholeSelection(reading: TechneReading, current: DisclosureSelection | null): DisclosureSelection {
  const wholeRef = reading.whole?.whole_ref;
  if (!wholeRef?.trim()) throw new Error(`Reading ${reading.reading_ref} discloses no whole to navigate to`);
  return refocusedSelection(reading, current, [wholeRef], wholeSelectionRef(reading.subject.subject_ref, wholeRef));
}
