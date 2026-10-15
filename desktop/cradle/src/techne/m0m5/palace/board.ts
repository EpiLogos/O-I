/**
 * The Palace board (lane-5 T15) — free spatial arrangement of the Palace's rooms, as PURE presentation.
 *
 * Moved here from the frame's `expressions-app/field-studies-journeys/src/palaceBoard.ts` (at fdc302870) when palaces moved onto
 * the atlas (T-PALACES-ONTO-ATLAS, FOUNDATION §3 N4). The arrangement law moved verbatim; what stayed behind with the frame is the
 * Research Canvas's own card vocabulary (`CANVAS_TOOL_SPEC.sticky.size`, the sticky palette tokens, the xyflow node and edge
 * shapes, the gesture batch), which the frame's board view drew and the atlas's floor plan does not use. The snap is the frame's
 * own (`canvasRepertoire.ts:115` snapToGrid), copied below unchanged.
 *
 * Laws carried here:
 *   - a board position is presentation state of one surface: it names a room by its key and holds a point. It never
 *     carries a Scene body, an order, a ref or a semantic relation, and moving a room writes no native document;
 *   - the room order stays the walk order. The board is a second arrangement over the same rooms, never a replacement
 *     for the guided path;
 *   - grid snap is an authoring aid, applied to the proposed point before it is held, and it is never identity: a room
 *     with snap off keeps the exact point it was dropped on;
 *   - a room the board does not hold yet is placed deterministically in walk order, so the board is never empty and
 *     never invents a position for a key the Palace does not carry;
 *   - lane-5 T16/T17: the board's connections are the guided path's own edges, passed through `boardEdges` (never a second
 *     set, never authored here), and the walk's focus is the room holding the focused ref (`boardFocusName`). Both are
 *     presentation over the reading and the walk; neither writes anything.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */

export interface BoardPoint {x: number; y: number}
/** The held positions of one Palace's board, keyed by room. Absent keys are placed by `defaultBoardPoint`. */
export type BoardPositions = Record<string, BoardPoint>;

/** The Research Canvas's grid: CANVAS_UNITS/4 (researchInstrumentsData.ts pins CANVAS_UNITS=400), with its reach CANVAS_UNITS/16. */
export const BOARD_GRID = 100;
export const BOARD_SNAP_REACH = 25;

const COLUMNS = 3;
const COLUMN_STRIDE = 300;
const ROW_STRIDE = 300;
const ORIGIN = BOARD_GRID;

/** A finite point, nothing else. */
export function isBoardPoint(value: unknown): value is BoardPoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const point = value as {x?: unknown; y?: unknown};
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** The position a room holds before anyone moves it: walk order, left to right, row by row, on the grid. */
export function defaultBoardPoint(index: number): BoardPoint {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return {x: ORIGIN + column * COLUMN_STRIDE, y: ORIGIN + row * ROW_STRIDE};
}

/** Every room in walk order, each at its held point or, where none is held, its default. Pure. */
export function boardPositions(names: readonly string[], held: BoardPositions): Record<string, BoardPoint> {
  const out: Record<string, BoardPoint> = {};
  names.forEach((name, index) => {
    const point = held[name];
    out[name] = isBoardPoint(point) ? {x: point.x, y: point.y} : defaultBoardPoint(index);
  });
  return out;
}

/** The frame's own snap (canvasRepertoire.ts:115 snapToGrid), unchanged: each axis takes the grid line within its reach. */
export function snapToGrid(position: BoardPoint, gridSize: number, threshold: number): BoardPoint {
  const candidate: BoardPoint = {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
  return {
    x: Math.abs(candidate.x - position.x) <= threshold ? candidate.x : position.x,
    y: Math.abs(candidate.y - position.y) <= threshold ? candidate.y : position.y,
  };
}

/** The point a proposed move holds: snapped to the Research Canvas grid when snap is on, exact when it is off. A non-finite point is returned unchanged. */
export function snapBoardPoint(point: BoardPoint, snap: boolean): BoardPoint {
  if (!isBoardPoint(point)) return point;
  return snap ? snapToGrid(point, BOARD_GRID, BOARD_SNAP_REACH) : {x: point.x, y: point.y};
}

/** Hold one room's point. A key the Palace does not carry, or a non-finite point, changes nothing. Pure. */
export function moveBoardRegion(held: BoardPositions, names: readonly string[], name: string, point: BoardPoint): BoardPositions {
  if (!names.includes(name) || !isBoardPoint(point)) return held;
  return {...held, [name]: {x: point.x, y: point.y}};
}

/** Drop a room's held point, so a removed room leaves no arrangement behind. Pure. */
export function forgetBoardRegion(held: BoardPositions, name: string): BoardPositions {
  if (!(name in held)) return held;
  const next = {...held};
  delete next[name];
  return next;
}

/** The rooms a selection names, in walk order. Keys the Palace does not carry are dropped; the selection is never invented. */
export function boardSelection(names: readonly string[], ids: readonly string[]): string[] {
  const picked = new Set(ids);
  return names.filter((name) => picked.has(name));
}

/** The one status line a selection says, in the Palace's own voice. */
export function boardSelectionLine(selected: readonly string[]): string {
  if (selected.length === 0) return 'No rooms selected on the board.';
  if (selected.length === 1) return `Selected 1 room: ${selected[0]}. The room list shows it.`;
  return `Selected ${selected.length} rooms: ${selected.join(', ')}. The room list shows them.`;
}

/**
 * Strict validate-then-accept for a held arrangement (the form the presentation store carries). A key the Palace no
 * longer holds is dropped, never repaired; a structurally drifted point makes the whole record absent (null).
 */
export function validateBoardPositions(value: unknown, names: readonly string[]): BoardPositions | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const known = new Set(names);
  const out: BoardPositions = {};
  for (const [name, point] of Object.entries(value as Record<string, unknown>)) {
    if (!known.has(name)) continue;
    if (!isBoardPoint(point)) return null;
    out[name] = {x: point.x, y: point.y};
  }
  return out;
}

/** lane-5 T17: the room the walk's focused ref stands in, by the refs each room holds. Null when the focused element is in no
 * room (a source, a whole): the board then highlights nothing rather than guess. Pure. */
export function boardFocusName(rooms: readonly {name: string; refs: readonly string[]}[], focusRef: string | null): string | null {
  if (focusRef === null) return null;
  return rooms.find((room) => room.refs.includes(focusRef))?.name ?? null;
}

/** The kinds a derived board connection can take: a plain path, a gap, a broken reference, a self reference. */
export type BoardEdgeKind = 'path' | 'gap' | 'broken' | 'self';

/** One connection the board draws between two rooms. Derived from the guided path (never authored here). */
export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  kind: BoardEdgeKind;
  /** The short word the line carries (a broken or self edge is named, never hidden); empty for a plain path. */
  label: string;
  reason: string;
}

const BOARD_EDGE_LABEL: Record<BoardEdgeKind, string> = {
  // A plain path line carries no label: only what needs attention (gap, broken, self) is named on the board; its reason stays on hover.
  path: '',
  gap: 'gap',
  broken: 'broken',
  self: 'self',
};

/** The board's connections, from the guided path's own edges (lane-5 T16). An edge naming a room the board does not hold is
 * dropped: the board never draws a line to a room it does not show. Pure: a reorder of the path re-derives the lines. */
export function boardEdges(
  guided: readonly {from: string; to: string; kind: BoardEdgeKind; reason: string}[],
  names: readonly string[],
): BoardEdge[] {
  const known = new Set(names);
  return guided
    .filter((edge) => known.has(edge.from) && known.has(edge.to))
    .map((edge, index) => ({
      id: `palace-guided-${index}`,
      source: edge.from,
      target: edge.to,
      kind: edge.kind,
      label: BOARD_EDGE_LABEL[edge.kind],
      reason: edge.reason,
    }));
}
