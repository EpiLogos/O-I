/**
 * The Palace board (lane-5 T15) — free spatial arrangement of the Palace's regions, as PURE presentation.
 *
 * Laws carried here:
 *   - a board position is presentation state of one surface: it names a region by its name and holds a point. It never
 *     carries a Scene, a body, an order, a ref or a semantic relation, and moving a region writes no native document;
 *   - the linear region list stays the walk order. The board is a second arrangement over the same regions, never a
 *     replacement for the guided path;
 *   - grid snap is an authoring aid, applied to the proposed point before it is held, and it is never identity: a
 *     region with snap off keeps the exact point it was dropped on;
 *   - a region the board does not hold yet is placed deterministically in walk order, so the board is never empty and
 *     never invents a position for a name the Palace does not carry;
 *   - the card's size and fill are the Research Canvas's own sticky vocabulary (canvasShapes.ts); the fill is a palette
 *     TOKEN, never a colour value;
 *   - lane-5 T16/T17: the board's connections are the guided path's own edges, passed through `boardEdges` (never a second
 *     set, never authored here), and the walk's focus is the card holding the focused Expression (`boardFocusName`). Both are
 *     presentation over the reading and the walk; neither writes anything.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test` (via the build).
 */
import {CANVAS_TOOL_SPEC, paletteToken, STICKY_DEFAULT_PALETTE, type PaletteKey} from './canvasShapes.js';
import {snapToGrid} from './canvasRepertoire.js';

export interface BoardPoint {x: number; y: number}
/** The held positions of one Palace's board, keyed by region name. Absent names are placed by `defaultBoardPoint`. */
export type BoardPositions = Record<string, BoardPoint>;

/** The Research Canvas's grid: CANVAS_UNITS/4 (researchInstrumentsData.ts pins CANVAS_UNITS=400), with its reach CANVAS_UNITS/16. */
export const BOARD_GRID = 100;
export const BOARD_SNAP_REACH = 25;
/** A region card is the Research Canvas's own sticky size. */
export const BOARD_REGION_SIZE: {width: number; height: number} = CANVAS_TOOL_SPEC.sticky.size;
/** Free composition is quiet: every region card takes the same stone token, the palette key the Research Canvas uses for quiet stickies. */
export const BOARD_REGION_PALETTE: PaletteKey = 'stone';

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

/** The position a region holds before anyone moves it: walk order, left to right, row by row, on the grid. */
export function defaultBoardPoint(index: number): BoardPoint {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return {x: ORIGIN + column * COLUMN_STRIDE, y: ORIGIN + row * ROW_STRIDE};
}

/** Every region in walk order, each at its held point or, where none is held, its default. Pure. */
export function boardPositions(names: readonly string[], held: BoardPositions): Record<string, BoardPoint> {
  const out: Record<string, BoardPoint> = {};
  names.forEach((name, index) => {
    const point = held[name];
    out[name] = isBoardPoint(point) ? {x: point.x, y: point.y} : defaultBoardPoint(index);
  });
  return out;
}

/** The point a proposed move holds: snapped to the Research Canvas grid when snap is on, exact when it is off. A non-finite point is returned unchanged. */
export function snapBoardPoint(point: BoardPoint, snap: boolean): BoardPoint {
  if (!isBoardPoint(point)) return point;
  return snap ? snapToGrid(point, BOARD_GRID, BOARD_SNAP_REACH) : {x: point.x, y: point.y};
}

/** Hold one region's point. A name the Palace does not carry, or a non-finite point, changes nothing. Pure. */
export function moveBoardRegion(held: BoardPositions, names: readonly string[], name: string, point: BoardPoint): BoardPositions {
  if (!names.includes(name) || !isBoardPoint(point)) return held;
  return {...held, [name]: {x: point.x, y: point.y}};
}

/** Drop a region's held point, so a removed region leaves no arrangement behind. Pure. */
export function forgetBoardRegion(held: BoardPositions, name: string): BoardPositions {
  if (!(name in held)) return held;
  const next = {...held};
  delete next[name];
  return next;
}

/** The regions a selection names, in walk order. Ids the Palace does not carry are dropped; the selection is never invented. */
export function boardSelection(names: readonly string[], ids: readonly string[]): string[] {
  const picked = new Set(ids);
  return names.filter((name) => picked.has(name));
}

/** The one status line a selection says, in the Palace's own voice. */
export function boardSelectionLine(selected: readonly string[]): string {
  if (selected.length === 0) return 'No regions selected on the board.';
  if (selected.length === 1) return `Selected 1 region: ${selected[0]}. The region list shows it.`;
  return `Selected ${selected.length} regions: ${selected.join(', ')}. The region list shows them.`;
}

/**
 * Strict validate-then-accept for a held arrangement (the form the presentation store will carry). A name the Palace no
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

/** The title a region card shows: its name, and the contained Expression's own title where one is composed. */
export function boardTitle(name: string, member: {title: string; expression_ref: string} | null): string {
  if (!member) return name;
  return `${name} · ${member.title || member.expression_ref}`;
}

/** A region card as the Research Canvas's sticky object: plain data, typed by the view that hands it to the canvas. */
export interface BoardNode {
  id: string;
  type: 'sticky';
  position: BoardPoint;
  size: {width: number; height: number};
  title: string;
  bgColour: string;
  selected: boolean;
  /** lane-5 T17: this card is the walk's focused element. */
  focused: boolean;
}

/** lane-5 T17: the focused walk element's card takes the Research Canvas's warm default token, so the one walk focus stands out
 * from the quiet stone of every other card. The card also names the focus in its label. */
export const BOARD_FOCUS_PALETTE: PaletteKey = STICKY_DEFAULT_PALETTE;

/** lane-5 T17: the board card the walk's focused ref stands on, by the card's own contained Expression. Null when the focused
 * element is not a board card (a Scene, a place, a source): the board then highlights nothing rather than guess. Pure. */
export function boardFocusName(
  regions: readonly {name: string; member: {expression_ref: string} | null}[],
  focusRef: string | null,
): string | null {
  if (focusRef === null) return null;
  return regions.find((region) => region.member?.expression_ref === focusRef)?.name ?? null;
}

/** The board's nodes, in walk order, each at its displayed point. The focused card (lane-5 T17) takes the focus token and names
 * itself as the walk focus; every other card keeps the quiet token. Pure. */
export function boardNodes(
  regions: readonly {name: string; member: {title: string; expression_ref: string} | null}[],
  positions: Record<string, BoardPoint>,
  selected: readonly string[],
  focused: string | null = null,
): BoardNode[] {
  const picked = new Set(selected);
  return regions.map((region) => {
    const isFocus = region.name === focused;
    const title = boardTitle(region.name, region.member);
    return {
      id: region.name,
      type: 'sticky',
      position: {x: positions[region.name].x, y: positions[region.name].y},
      size: {...BOARD_REGION_SIZE},
      title: isFocus ? `Walk focus: ${title}` : title,
      bgColour: paletteToken(isFocus ? BOARD_FOCUS_PALETTE : BOARD_REGION_PALETTE),
      selected: picked.has(region.name),
      focused: isFocus,
    };
  });
}

/** The kinds a derived board connection can take: a plain path, a gap, a broken reference, a self reference. */
export type BoardEdgeKind = 'path' | 'gap' | 'broken' | 'self';

/** One connection the board draws between two region cards. Derived from the guided path (never authored here). */
export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  kind: BoardEdgeKind;
  /** The short word the line carries on the canvas (a broken or self edge is named, never hidden). */
  label: string;
  /** The one-line note on the canvas, empty for a plain path. */
  note: string;
  /** The Research Canvas connector shape for the kind: a straight path, a dashed-looking elbow for gap and broken, a curve for self. */
  connector: 'straight' | 'elbow' | 'curved';
  reason: string;
}

const BOARD_EDGE_TEXT: Record<BoardEdgeKind, {label: string; note: string; connector: BoardEdge['connector']}> = {
  // A plain path line carries no label: only what needs attention (gap, broken, self) is named on the board; its reason stays on hover.
  path: {label: '', note: '', connector: 'straight'},
  gap: {label: 'gap', note: 'no Expression yet', connector: 'elbow'},
  broken: {label: 'broken', note: 'reference broken', connector: 'elbow'},
  self: {label: 'self', note: "this Palace's own Expression", connector: 'curved'},
};

/** The board's connections, from the guided path's own edges (lane-5 T16). An edge naming a region the board does not hold is
 * dropped: the board never draws a line to a card it does not show. Pure: a reorder of the path re-derives the lines. */
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
      label: BOARD_EDGE_TEXT[edge.kind].label,
      note: BOARD_EDGE_TEXT[edge.kind].note,
      connector: BOARD_EDGE_TEXT[edge.kind].connector,
      reason: edge.reason,
    }));
}

/**
 * One board gesture commits each dragged region in the same synchronous pass. This collects those commits and hands the
 * whole set to `apply` ONCE, after the pass (`schedule` is a microtask in the view). One gesture is one apply, so one save.
 */
export function commitBatch(
  apply: (points: Record<string, BoardPoint>) => void,
  schedule: (task: () => void) => void,
): (name: string, point: BoardPoint) => void {
  let pending: Record<string, BoardPoint> | null = null;
  return (name, point) => {
    if (pending === null) {
      const batch: Record<string, BoardPoint> = {};
      pending = batch;
      schedule(() => {
        pending = null;
        if (Object.keys(batch).length > 0) apply(batch);
      });
    }
    pending[name] = {x: point.x, y: point.y};
  };
}
