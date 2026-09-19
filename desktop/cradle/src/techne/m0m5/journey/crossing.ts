/**
 * The M3′ crossing (L5 Technē T5 — issue #216) — the formal 4:2 ↔ 3:3
 * bridge law, executable. Journey is the hinge: entering a scene crosses the
 * DisclosureSession onto the conjugate 3:3 Expression reading carrying the
 * EXACT scene ref; returning restores the exact Journey position. Locked
 * laws carried in code (dual-reading lock §§12–13, §22; TB0-1 cross-cut
 * identity):
 *
 *   - crossing changes disclosure, never identity: subject, selection,
 *     source/revision basis, agent session and occasion are untouched (the
 *     session store guarantees this; this module guarantees the scene ref
 *     rides the selection verbatim and proves nothing else moved);
 *   - the scene ref rides the selection's own `focus_refs` — the contract's
 *     existing focus field, so no mirror extension and no second channel
 *     exists (the ported TS mirror is at the T0 field set; `scene_focus_ref`
 *     on the canonical TB0-1 session schema is the pinned upstream spelling —
 *     recorded for #212/#219, not privately mirrored here);
 *   - the application cut is DERIVED from the instrument (TB0-1: expressions
 *     ↔ 3:3-conjugate, deep instruments ↔ 4:2-deep) — derived, never stored,
 *     so it cannot drift from the instrument it describes;
 *   - a crossing onto the cut already occupied is refused (TB0-1
 *     `cross_cut` law);
 *   - Return is exact: the beat the focus names is found by scene_ref
 *     equality, never by index guessing.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {
  DisclosureSelection,
  DisclosureSession,
  TechneInstrument,
  TechneReadingKind,
} from "../../contract.ts";
import type { JourneyBeat } from "./beats.ts";

/** The canonical Expression crossing target. */
export const EXPRESSION_INSTRUMENT: TechneInstrument = "expressions";

/** The TB0-1 application-cut law: which reading each instrument carries. */
export function cutFor(instrument: TechneInstrument): TechneReadingKind {
  return instrument === "expressions" ? "3:3-conjugate" : "4:2-deep";
}

/** A crossing onto the cut already occupied is refused (TB0-1 `cross_cut`). */
export function crossCutGuard(current: TechneInstrument, target: TechneInstrument): void {
  if (current === target) {
    throw new Error(`crossing refused: ${current} already carries the ${cutFor(current)} cut — a crossing moves between the two readings, never onto itself`);
  }
  if (cutFor(current) === cutFor(target)) {
    throw new Error(`crossing refused: ${current} → ${target} stays inside the ${cutFor(current)} cut — the M3′ bridge crosses 4:2 ↔ 3:3`);
  }
}

/** The scene focus carried on a selection: the selection's own focus_refs
 * with the scene ref appended exactly once, everything else byte-identical.
 * Returns the SAME selection object when the focus already names the scene —
 * a crossing that changes nothing must not rebuild state. */
export function selectionWithSceneFocus(selection: DisclosureSelection, sceneRef: string): DisclosureSelection {
  if (!sceneRef.trim()) throw new Error("scene focus refused: the scene ref is empty");
  const focus = selection.focus_refs ?? [];
  if (focus.includes(sceneRef)) return selection;
  return { ...selection, focus_refs: [...focus, sceneRef] };
}

/** The exact scene ref the selection carries as its Journey scene focus, or
 * null. The LAST journey-named focus wins (the most recent entry); a ref that
 * names no scene of this reading is data, not an error — the caller discloses
 * the honest miss. */
export function sceneFocusOf(selection: DisclosureSelection, beats: readonly JourneyBeat[]): string | null {
  const named = (selection.focus_refs ?? []).filter((ref) => beats.some((beat) => beat.scene_ref === ref));
  return named.length ? named[named.length - 1] : null;
}

/** The beat a scene focus names — exact ref equality, never an index. */
export function beatForSceneFocus(beats: readonly JourneyBeat[], sceneRef: string | null): JourneyBeat | null {
  if (!sceneRef) return null;
  return beats.find((beat) => beat.scene_ref === sceneRef) ?? null;
}

/** The session crossing into the conjugate Expression reading: the guard
 * holds, the scene focus rides the selection, and the session that comes back
 * is asserted unchanged in every identity field the lock protects. The
 * caller applies the returned selection through the session store
 * (`setSelection` then `openInInstrument`); this function owns the LAW,
 * the store owns the state. */
export function crossToExpression(session: DisclosureSession, sceneRef: string): { selection: DisclosureSelection; target: TechneInstrument } {
  crossCutGuard(session.instrument, EXPRESSION_INSTRUMENT);
  const carried = selectionWithSceneFocus(session.selection, sceneRef);
  const before = session;
  if (
    carried.subject_ref !== before.subject_ref
    || carried.reading_ref !== before.reading_ref
    || carried.selection_ref !== before.selection.selection_ref
    || carried.agent_session_ref !== before.selection.agent_session_ref
  ) {
    throw new Error("crossing refused: the scene focus changed a protected identity — subject, reading basis, selection ref and agent session must cross untouched");
  }
  return { selection: carried, target: EXPRESSION_INSTRUMENT };
}

/** Return: where the Journey re-enters after the live Expression. The
 * session's scene focus names the exact beat to restore; a session that lost
 * the focus (or names a scene this reading no longer discloses) returns an
 * honest miss, never a guessed position. */
export function returnPosition(session: DisclosureSession, beats: readonly JourneyBeat[]): { beat: JourneyBeat | null; focus_ref: string | null } {
  const focus = sceneFocusOf(session.selection, beats);
  return { beat: beatForSceneFocus(beats, focus), focus_ref: focus };
}
