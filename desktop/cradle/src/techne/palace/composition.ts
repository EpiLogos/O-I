/**
 * The Palace composition floor (L5 Technē T6) — the mnemonic/artistic/
 * pedagogical composition surface over the reading's real Expression refs
 * (QL-MEF wayfinder §10, §18 T6).
 *
 * Laws carried here:
 *   - elements ARE the reading's `expressions[]` entries, verbatim —
 *     expression_ref, scene_ref, revision are never minted, re-keyed or
 *     shortened;
 *   - the arrangement (grid rooms and loci) is LOCAL presentation state of
 *     one surface: moving an element asserts no semantic relation, mutates
 *     nothing in the reading, and persists nowhere (no localStorage, no
 *     IndexedDB, no Palace record);
 *   - there is no second knowledge graph and no second Scene type: the
 *     composition proposal names the Expression substrate's own
 *     `scene_compose` change (`../expression/types.ts` Change union) and is
 *     ROUTED to the disclosed Expression-owner Action — the native owner
 *     executes under its own authority, never the Palace;
 *   - no stochastic identity: every derivation is a pure function of its
 *     inputs, so re-deriving yields the same elements in the same order.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { NativeActionRef, TechneExpressionBinding, TechneReading } from "../contract.ts";

/** One palace element: a verbatim Expression binding from the reading. */
export type PalaceElement = TechneExpressionBinding;

/** One room of the bounded memory space, addressed column-major by index. */
export interface PalaceRoom {
  column: number;
  row: number;
}

/** One locus: a slot inside a room where exactly one element may stand. */
export interface PalaceLocus {
  room: PalaceRoom;
  locus: number;
}

/** One placement: which expression stands at which locus. Presentation only. */
export interface PalacePlacement {
  expression_ref: string;
  locus: PalaceLocus;
}

/** The arrangement of elements over the bounded memory space. Local state of
 * one Palace surface; never written back into a reading or anywhere else. */
export interface PalaceArrangement {
  rooms: { columns: number; rows: number };
  loci_per_room: number;
  placements: PalacePlacement[];
}

/** The shape of the bounded memory space. Fixed, so every surface derives
 * the same walk from the same arrangement. */
export const PALACE_ROOMS: { columns: number; rows: number } = { columns: 3, rows: 2 };
export const PALACE_LOCI_PER_ROOM = 4;
/** Loci inside a room sit on a square span (2×2 for 4 loci). */
export const PALACE_LOCUS_SPAN = 2;

/** The proposal's change kind: the Expression substrate's own composition
 * change (Change union, `scene_compose`) — never a Palace persistence shape. */
export type PalaceComposeKind = "scene_compose";

/** The route input carried to the Expression owner: the target expression,
 * the scene to compose into (the binding's own scene_ref, verbatim) and the
 * composed element refs in arrangement order. */
export interface PalaceCompositionInput {
  expression_ref: string;
  change: { kind: PalaceComposeKind; scene_ref: string | null; elements: string[] };
}

/** A native composition proposal: an Action route plus its input. Routing
 * and execution stay with the adapter and the native owner. */
export interface PalaceCompositionProposal {
  action_ref: string;
  input: PalaceCompositionInput;
}

/** The fallback Expression-owner action when the reading discloses none. */
export const FALLBACK_EXPRESSION_ACTION = "oi.expression.edit";

// ---------------------------------------------------------------------------
// Elements — the reading's own Expression bindings, verbatim
// ---------------------------------------------------------------------------

/** The reading's Expression bindings, verbatim and in reading order. An
 * absent or empty facet is data, not an error: zero elements is an honest
 * empty palace. */
export function palaceElements(reading: TechneReading): PalaceElement[] {
  return (reading.expressions ?? []).map((binding) => ({ ...binding }));
}

/** Capability honesty for the pane: the Palace is available exactly when the
 * reading binds at least one Expression; the reason for absence is the
 * reading's own disclosure, never an invented one. */
export function palaceAvailability(reading: TechneReading | null): { available: boolean; reason: string | null } {
  if (!reading) return { available: false, reason: null };
  if (palaceElements(reading).length > 0) return { available: true, reason: null };
  const entry = reading.disclosure.instruments.find((candidate) => candidate.instrument === "palace");
  return { available: false, reason: entry && entry.available === false ? entry.reason ?? null : null };
}

// ---------------------------------------------------------------------------
// Arrangement — local presentation state over the bounded memory space
// ---------------------------------------------------------------------------

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** A locus clamped into the bounded space. */
export function clampLocus(locus: PalaceLocus): PalaceLocus {
  return {
    room: {
      column: clamp(Math.trunc(locus.room.column), 0, PALACE_ROOMS.columns - 1),
      row: clamp(Math.trunc(locus.room.row), 0, PALACE_ROOMS.rows - 1),
    },
    locus: clamp(Math.trunc(locus.locus), 0, PALACE_LOCI_PER_ROOM - 1),
  };
}

/** Spatial sort key: rooms walk row-major, loci in locus order inside the
 * room. The walk order is a pure function of the positions — never of
 * insertion order, never of a stochastic source. */
export function locusKey(locus: PalaceLocus): string {
  return `${locus.room.row}:${locus.room.column}:${locus.locus}`;
}

/** The deterministic initial arrangement: elements stand at the loci of the
 * bounded space in reading order, walking rooms row-major. */
export function defaultArrangement(elements: readonly PalaceElement[]): PalaceArrangement {
  const placements: PalacePlacement[] = elements.map((element, index) => {
    const roomIndex = Math.floor(index / PALACE_LOCI_PER_ROOM);
    return {
      expression_ref: element.expression_ref,
      locus: clampLocus({
        room: {
          column: roomIndex % PALACE_ROOMS.columns,
          row: Math.floor(roomIndex / PALACE_ROOMS.columns),
        },
        locus: index % PALACE_LOCI_PER_ROOM,
      }),
    };
  });
  return { rooms: { ...PALACE_ROOMS }, loci_per_room: PALACE_LOCI_PER_ROOM, placements: sortPlacements(placements) };
}

/** Spatial order: rooms walk row-major, loci in locus order inside the room.
 * Numeric, so the walk is identical for any bounds. */
export function locusOrder(a: PalaceLocus, b: PalaceLocus): number {
  if (a.room.row !== b.room.row) return a.room.row - b.room.row;
  if (a.room.column !== b.room.column) return a.room.column - b.room.column;
  return a.locus - b.locus;
}

function sortPlacements(placements: readonly PalacePlacement[]): PalacePlacement[] {
  return [...placements].sort((a, b) => locusOrder(a.locus, b.locus));
}

/** Move one element to a locus. Pure: returns a new arrangement; the reading
 * and every other surface are untouched. A move asserts no semantic relation
 * — positions are presentation. The locus stands in the bounded space; if
 * another element already stands there, the two swap loci. */
export function arrangeAt(arrangement: PalaceArrangement, expression_ref: string, locus: PalaceLocus): PalaceArrangement {
  const target = clampLocus(locus);
  const moved = arrangement.placements.find((placement) => placement.expression_ref === expression_ref);
  if (!moved) return arrangement;
  if (locusKey(moved.locus) === locusKey(target)) return arrangement;
  const displaced = arrangement.placements.find(
    (placement) => placement.expression_ref !== expression_ref && locusKey(placement.locus) === locusKey(target),
  );
  const placements = arrangement.placements.map((placement): PalacePlacement => {
    if (placement.expression_ref === expression_ref) return { expression_ref, locus: target };
    if (displaced && placement.expression_ref === displaced.expression_ref) {
      return { expression_ref: placement.expression_ref, locus: moved.locus };
    }
    return placement;
  });
  return { ...arrangement, placements: sortPlacements(placements) };
}

/** The element refs in arrangement order — the spatial walk over occupied
 * loci. This is the order the composition carries and recall follows. */
export function arrangementOrder(arrangement: PalaceArrangement): string[] {
  return sortPlacements(arrangement.placements).map((placement) => placement.expression_ref);
}

// ---------------------------------------------------------------------------
// Composition — the native proposal routed to the Expression owner
// ---------------------------------------------------------------------------

/** The reading's disclosed Expression-owner Action — the first disclosed
 * action in the Expression-owner namespace (`oi.expression.*`). Returns null
 * when the reading discloses none, in which case the proposal names the
 * fallback owner action and honest routing may refuse it. */
export function expressionOwnerAction(actions: readonly NativeActionRef[] | undefined): NativeActionRef | null {
  return (actions ?? []).find((action) => action.action_ref.startsWith("oi.expression.")) ?? null;
}

/** Compose the arranged elements into the native composition proposal. The
 * proposal targets the first element in arrangement order: its expression_ref
 * names the target Expression, its scene_ref (verbatim, nullable) names the
 * scene, and the arranged element refs ride in order inside the substrate's
 * `scene_compose` change. Returns null when there is nothing to compose.
 * Nothing is executed and nothing is persisted here. */
export function composeChange(
  elements: readonly PalaceElement[],
  arrangement: PalaceArrangement,
  actions?: readonly NativeActionRef[],
): PalaceCompositionProposal | null {
  if (elements.length === 0) return null;
  const present = new Set(elements.map((element) => element.expression_ref));
  const ordered = arrangementOrder(arrangement).filter((ref) => present.has(ref));
  const orderedRefs = ordered.length > 0 ? ordered : elements.map((element) => element.expression_ref);
  const target = elements.find((element) => element.expression_ref === orderedRefs[0]) ?? elements[0];
  const disclosed = expressionOwnerAction(actions);
  return {
    action_ref: disclosed ? disclosed.action_ref : FALLBACK_EXPRESSION_ACTION,
    input: {
      expression_ref: target.expression_ref,
      change: { kind: "scene_compose", scene_ref: target.scene_ref ?? null, elements: orderedRefs },
    },
  };
}
