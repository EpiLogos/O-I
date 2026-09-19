/**
 * The Canvas direct-manipulation model (L5 Technē M1′, QL-MEF #214) — the
 * PURE geometry of mature canvas interaction: lasso/multi-select, group
 * moves, align, distribute, snap-with-guides, bounding boxes, and semantic
 * zoom thresholds. No React, no DOM, no store: the surface hands this model
 * plain layout data and applies the returned presentation overrides itself.
 *
 * Everything here produces or consumes PRESENTATION state (positions,
 * selection, guides). Nothing here can touch a reading, a session or a
 * native relation — there is no parameter for any of them.
 *
 * Interaction patterns ported as new code from the Research Canvas canvas
 * (read-only interaction source): centre-in-shape lasso hit-testing, group
 * (frame) translation by delta, alignment/distribution over selection
 * bounding boxes, and rubber-band selection. None of its substrate
 * assumptions come along.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { ConstellationNode } from "./layout.ts";
import type { LayoutOverrides } from "./layout.ts";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A node with its current (override-applied) position, for the model. */
export interface PositionedNode {
  ref: string;
  x: number;
  y: number;
  /** Hit radius in unit space (the renderer's node radius / UNIT_SCALE). */
  radius: number;
}

// ---------------------------------------------------------------------------
// Hit testing and lasso
// ---------------------------------------------------------------------------

/** True when the point sits within a node's hit radius. */
export function hitTestNode(node: PositionedNode, point: Point): boolean {
  const dx = point.x - node.x;
  const dy = point.y - node.y;
  return dx * dx + dy * dy <= node.radius * node.radius;
}

/** The topmost node under the point (last in render order wins), if any. */
export function hitTestTopmost(nodes: PositionedNode[], point: Point): PositionedNode | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (hitTestNode(nodes[index], point)) return nodes[index];
  }
  return null;
}

/** Lasso (rubber-band / polygon) selection: a node is selected when its
 * CENTRE is inside the polygon — the classic Research Canvas rule, and the
 * forgiving one for circular nodes. Ray-casting point-in-polygon; open
 * polygons (fewer than 3 points) select nothing. */
export function lassoSelect(nodes: PositionedNode[], polygon: Point[]): string[] {
  if (polygon.length < 3) return [];
  return nodes.filter((node) => pointInPolygon(node, polygon)).map((node) => node.ref);
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = a.y > point.y !== b.y > point.y
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Multi-selection moves (with frame translation)
// ---------------------------------------------------------------------------

/** Move the selected refs by one delta, FROM their current positions (the
 * surface passes nodes already override-applied). Returns only the moved
 * refs' overrides; other overrides pass through untouched. The whole node is
 * movable like any other — arrangement is presentation, the whole is still
 * the reading's whole. */
export function moveSelection(
  nodes: PositionedNode[],
  selectedRefs: readonly string[],
  delta: Point,
): LayoutOverrides {
  const selected = new Set(selectedRefs);
  const overrides: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    if (!selected.has(node.ref)) continue;
    overrides[node.ref] = { x: tidy(node.x + delta.x), y: tidy(node.y + delta.y) };
  }
  return overrides;
}

/** Translate every member of one frame by a delta (dragging the frame's
 * title bar): the frame's members are the refs, the motion is presentation. */
export function moveFrame(
  nodes: PositionedNode[],
  frameMemberRefs: readonly string[],
  delta: Point,
): LayoutOverrides {
  return moveSelection(nodes, frameMemberRefs, delta);
}

/** Nudge (keyboard): an axis-step of the selection. Pure sugar over
 * `moveSelection` so the keyboard path and the pointer path cannot drift. */
export function nudgeSelection(
  nodes: PositionedNode[],
  selectedRefs: readonly string[],
  axis: "left" | "right" | "up" | "down",
  step: number,
): LayoutOverrides {
  const delta: Point = {
    x: axis === "left" ? -step : axis === "right" ? step : 0,
    y: axis === "up" ? -step : axis === "down" ? step : 0,
  };
  return moveSelection(nodes, selectedRefs, delta);
}

/** Clear the overrides of exactly the selected refs (the keyboard
 * "reset arrangement" path). Returns which refs actually had an override. */
export function resetSelectionArrangement(overrides: LayoutOverrides, selectedRefs: readonly string[]): { overrides: LayoutOverrides; reset: string[] } {
  const next: Record<string, { x: number; y: number }> = { ...overrides };
  const reset: string[] = [];
  for (const ref of selectedRefs) {
    if (ref in next) {
      delete next[ref];
      reset.push(ref);
    }
  }
  return { overrides: next, reset };
}

// ---------------------------------------------------------------------------
// Align / distribute
// ---------------------------------------------------------------------------

export type AlignMode = "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter";

/** Align the selection to the selection's own bounding box. Needs two or
 * more selected nodes; the whole node aligns like anything else. */
export function alignSelected(nodes: PositionedNode[], selectedRefs: readonly string[], mode: AlignMode): LayoutOverrides {
  const selected = selectedNodes(nodes, selectedRefs);
  if (selected.length < 2) return {};
  const box = boundingBoxOf(selected);
  const overrides: Record<string, { x: number; y: number }> = {};
  for (const node of selected) {
    let { x, y } = node;
    switch (mode) {
      case "left": x = box.x; break;
      case "right": x = box.x + box.width; break;
      case "top": y = box.y; break;
      case "bottom": y = box.y + box.height; break;
      case "hcenter": x = box.x + box.width / 2; break;
      case "vcenter": y = box.y + box.height / 2; break;
    }
    overrides[node.ref] = { x: tidy(x), y: tidy(y) };
  }
  return overrides;
}

/** Distribute the selection evenly along one axis (by node centres), inside
 * the selection's own extent. Needs three or more selected nodes. Only the
 * moved axis changes; the other coordinate is preserved. */
export function distributeSelected(nodes: PositionedNode[], selectedRefs: readonly string[], axis: "h" | "v"): LayoutOverrides {
  const selected = selectedNodes(nodes, selectedRefs);
  if (selected.length < 3) return {};
  const ordered = [...selected].sort((a, b) => (axis === "h" ? a.x - b.x : a.y - b.y));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const span = axis === "h" ? last.x - first.x : last.y - first.y;
  const step = span / (ordered.length - 1);
  const overrides: Record<string, { x: number; y: number }> = {};
  ordered.forEach((node, index) => {
    if (axis === "h") overrides[node.ref] = { x: tidy(first.x + step * index), y: tidy(node.y) };
    else overrides[node.ref] = { x: tidy(node.x), y: tidy(first.y + step * index) };
  });
  return overrides;
}

// ---------------------------------------------------------------------------
// Snap and guides
// ---------------------------------------------------------------------------

export interface SnapResult {
  position: Point;
  /** Guide lines to render while snapped: each carries the shared coordinate
   * and its axis. Presentation only, drawn then dropped. */
  guides: Array<{ axis: "x" | "y"; at: number }>;
}

/** Snap a dragged position to the other nodes' centres (and optionally the
 * origin axes) within a threshold. The dragged node's own ref is excluded
 * from attraction. Guides name the line the position snapped to. */
export function snapPosition(
  position: Point,
  others: PositionedNode[],
  draggedRef: string,
  threshold: number,
  options: { snapToOrigin?: boolean } = {},
): SnapResult {
  let bestAxis: "x" | "y" | null = null;
  let bestAt = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const consider = (axis: "x" | "y", at: number) => {
    const distance = Math.abs((axis === "x" ? position.x : position.y) - at);
    if (distance <= threshold && distance < bestDistance) {
      bestAxis = axis;
      bestAt = at;
      bestDistance = distance;
    }
  };
  for (const other of others) {
    if (other.ref === draggedRef) continue;
    consider("x", other.x);
    consider("y", other.y);
  }
  if (options.snapToOrigin) {
    consider("x", 0);
    consider("y", 0);
  }
  if (bestAxis === null) return { position, guides: [] };
  const snapped: Point =
    bestAxis === "x"
      ? { x: tidy(bestAt), y: position.y }
      : { x: position.x, y: tidy(bestAt) };
  return { position: snapped, guides: [{ axis: bestAxis, at: bestAt }] };
}

// ---------------------------------------------------------------------------
// Bounds, boxes, semantic zoom
// ---------------------------------------------------------------------------

export function boundingBoxOf(nodes: PositionedNode[]): Rect {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const maxY = Math.max(...nodes.map((node) => node.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The bounds a saved view records: the layout's bounding box grown by each
 * node's radius, so the artifact describes the arranged extent rather than
 * centre points alone. */
export function viewBounds(nodes: PositionedNode[]): Rect {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const box = boundingBoxOf(nodes);
  const grow = Math.max(...nodes.map((node) => node.radius));
  return { x: box.x - grow, y: box.y - grow, width: box.width + grow * 2, height: box.height + grow * 2 };
}

/** Semantic zoom (wayfinder §6): what the constellation discloses at a
 * camera scale. Thresholds are presentation policy, deterministic so tests
 * and renderers agree:
 *   - below 0.7  → "constellation": skeleton only, labels off;
 *   - below 1.6  → "named": node labels on, relation labels off;
 *   - at/above   → "detailed": everything labelled. */
export type SemanticZoomLevel = "constellation" | "named" | "detailed";

export function semanticZoomLevel(scale: number): SemanticZoomLevel {
  if (scale < 0.7) return "constellation";
  if (scale < 1.6) return "named";
  return "detailed";
}

/** Which labels a zoom level shows — the renderer reads this, not its own
 * thresholds, so the disclosure policy has one home. */
export function labelsForZoom(level: SemanticZoomLevel): { nodeLabels: boolean; relationLabels: boolean } {
  switch (level) {
    case "constellation": return { nodeLabels: false, relationLabels: false };
    case "named": return { nodeLabels: true, relationLabels: false };
    case "detailed": return { nodeLabels: true, relationLabels: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function selectedNodes(nodes: PositionedNode[], selectedRefs: readonly string[]): PositionedNode[] {
  const selected = new Set(selectedRefs);
  return nodes.filter((node) => selected.has(node.ref));
}

function tidy(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/** Render-order helper the surface uses: draw frames below, nodes above,
 * proposals above nodes — the z-discipline of one canvas, presentation
 * only. */
export function drawOrder(nodes: ConstellationNode[]): ConstellationNode[] {
  const weight = (role: ConstellationNode["role"]) => (role === "whole" ? 1 : role === "member" ? 0 : 0);
  return [...nodes].sort((a, b) => weight(a.role) - weight(b.role));
}
