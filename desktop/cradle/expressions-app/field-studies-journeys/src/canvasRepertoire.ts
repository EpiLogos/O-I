/** Application-layer adapter over the m0m5 pure canvas interaction model
 * (src/techne/m0m5/canvas/interactions.ts) for the MOUNTED research
 * instruments canvas (InstrumentCanvas nodes, CANVAS_UNITS pixel space).
 * Multi-select, keyboard nudge, align, distribute and grid-snap all reduce
 * to that same pure geometry — this module only adapts CanvasNode-shaped
 * records to PositionedNode and carries no React and no live DOM dependency
 * of its own. The one screen-space concern (lasso hit-testing against
 * rendered node rectangles) is still pure arithmetic over rectangles the
 * caller supplies; this module never queries the DOM itself. */
import {
 lassoSelect,
 moveSelection,
 nudgeSelection,
 alignSelected,
 distributeSelected,
 semanticZoomLevel,
 labelsForZoom,
 type PositionedNode,
 type Point,
 type AlignMode,
 type SemanticZoomLevel,
} from '../../../src/techne/m0m5/canvas/interactions';
import type {LayoutOverrides} from '../../../src/techne/m0m5/canvas/layout';

export type {AlignMode, LayoutOverrides, SemanticZoomLevel, Point};
export {semanticZoomLevel, labelsForZoom};

export interface RepertoireNode {
 id: string;
 position: {x: number; y: number};
 size?: {width: number; height: number};
}

/** Top-left position IS the coordinate this module and the mounted canvas's
 * own gesture/preview plumbing already share (node.position, CANVAS_UNITS
 * space). Treating it directly as the interaction model's x/y keeps every
 * override this module returns drop-in compatible with moveGesture.preview
 * and host.move — no second conversion at the call site. `radius` is used
 * for lasso hit-testing only. */
export function positioned(nodes: readonly RepertoireNode[]): PositionedNode[] {
 return nodes.map(node => ({
  ref: node.id,
  x: node.position.x,
  y: node.position.y,
  radius: Math.max(40, (node.size?.width ?? 80) , (node.size?.height ?? 80)) / 2,
 }));
}

/** A lasso drawn in screen space, hit-tested against the rendered node
 * rectangles' screen centres — no viewport/flow transform is required
 * because both the lasso corners and the node rectangles are supplied in
 * the same (screen) space by the caller. */
export function lassoHitScreen(
 nodeRects: ReadonlyArray<{id: string; rect: {x: number; y: number; width: number; height: number}}>,
 lasso: {x: number; y: number; width: number; height: number},
): string[] {
 const polygon: Point[] = [
  {x: lasso.x, y: lasso.y},
  {x: lasso.x + lasso.width, y: lasso.y},
  {x: lasso.x + lasso.width, y: lasso.y + lasso.height},
  {x: lasso.x, y: lasso.y + lasso.height},
 ];
 const nodes: PositionedNode[] = nodeRects.map(({id, rect}) => ({
  ref: id,
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
  radius: Math.max(rect.width, rect.height) / 2,
 }));
 return lassoSelect(nodes, polygon);
}

export interface RepertoireMove {entityId: string; position: {x: number; y: number}}

/** Nudge every selected node by one axis-step (keyboard path), returning the
 * next top-left position for each — ready to feed straight into a preview
 * overlay and, at gesture end, a single batched commit. */
export function nudge(
 nodes: readonly RepertoireNode[],
 selectedRefs: readonly string[],
 axis: 'left' | 'right' | 'up' | 'down',
 step: number,
): LayoutOverrides {
 return nudgeSelection(positioned(nodes), selectedRefs, axis, step);
}

/** Translate the whole selection by one delta (the group-drag path): the
 * caller supplies the delta already resolved from the actively-dragged
 * node's own preview motion. */
export function translateSelection(
 nodes: readonly RepertoireNode[],
 selectedRefs: readonly string[],
 delta: Point,
): LayoutOverrides {
 return moveSelection(positioned(nodes), selectedRefs, delta);
}

export function align(nodes: readonly RepertoireNode[], selectedRefs: readonly string[], mode: AlignMode): LayoutOverrides {
 return alignSelected(positioned(nodes), selectedRefs, mode);
}

export function distribute(nodes: readonly RepertoireNode[], selectedRefs: readonly string[], axis: 'h' | 'v'): LayoutOverrides {
 return distributeSelected(positioned(nodes), selectedRefs, axis);
}

/** Grid-snap a single dragged node's proposed position: each axis rounds to
 * its nearest grid line independently, but only when within `threshold` of
 * it — otherwise that axis is left untouched. `interactions.ts`'s own
 * `snapPosition` snaps to OTHER NODES (picks the single closest axis across
 * every neighbour); a fixed grid is a different, simpler rule — both axes
 * can snap at once, each to its own nearest line — so this is deliberately
 * its own small function rather than a neighbour list dressed as a grid.
 * Guide LINES are not rendered: the mounted canvas has no live viewport
 * transform available to this module to place them against; the snap
 * itself still functions without them. */
export function snapToGrid(position: Point, gridSize: number, threshold: number): Point {
 const candidate: Point = {
  x: Math.round(position.x / gridSize) * gridSize,
  y: Math.round(position.y / gridSize) * gridSize,
 };
 return {
  x: Math.abs(candidate.x - position.x) <= threshold ? candidate.x : position.x,
  y: Math.abs(candidate.y - position.y) <= threshold ? candidate.y : position.y,
 };
}

/** Modifier-key tracking independent of the vendored Canvas's own pointer
 * handling (it does not report modifier state to onSelectNode). Attaches
 * window-level listeners for the instrument's lifetime; `dispose()` removes
 * them. Shift/Ctrl/Cmd are read live by the click handler that decides
 * whether a click replaces or extends the current selection. */
export interface ModifierState {shift: boolean; extend: boolean}
export function trackModifiers(target: {addEventListener: typeof window.addEventListener; removeEventListener: typeof window.removeEventListener} = window): {state: ModifierState; dispose: () => void} {
 const state: ModifierState = {shift: false, extend: false};
 const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Shift') state.shift = true;
  if (event.key === 'Meta' || event.key === 'Control') state.extend = true;
 };
 const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Shift') state.shift = false;
  if (event.key === 'Meta' || event.key === 'Control') state.extend = false;
 };
 // A window blur (alt-tab, devtools) can strand a key as "held" — clear both.
 const onBlur = () => {state.shift = false; state.extend = false;};
 target.addEventListener('keydown', onKeyDown, true);
 target.addEventListener('keyup', onKeyUp, true);
 target.addEventListener('blur', onBlur, true);
 return {
  state,
  dispose() {
   target.removeEventListener('keydown', onKeyDown, true);
   target.removeEventListener('keyup', onKeyUp, true);
   target.removeEventListener('blur', onBlur, true);
  },
 };
}
