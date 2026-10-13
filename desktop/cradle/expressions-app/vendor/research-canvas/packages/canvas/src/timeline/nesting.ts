/**
 * lane-2 T9 — nested events with zoom-collapsing structure (pure).
 *
 * A parent event holds child events through the explicit containment pairs the
 * host supplies. The contract has no containment relation family yet
 * (`projectionForRelation` knows cause, echo and opposition only), so this
 * module reads the pairs it is given and invents none.
 *
 * A parent's extent is the min/max of its present children's own extents; one
 * open child leaves the parent open at its end, never an invented end. A parent
 * collapses into one band-like span carrying its child count when the view is at
 * the marker tier (every card is a marker), or when two of its children would
 * sit closer than a card's width, so they do not separate at this zoom. A
 * collapsed parent hides its descendants. Nothing else moves: the caller's own
 * placement is filtered, never re-laid-out.
 */
import { msToPixel, type TimeCamera } from "./viewport";
import { DEFAULT_TIMELINE_CARD_WIDTH_PX } from "./projection";
import type { DensityBand } from "./scale";

/** Explicit containment: `child` sits inside `parent`. */
export interface NestingPair {
  parent: string;
  child: string;
}

/** A placed item's honest extent, epoch ms; `toMs` is its end (exclusive), null when open. */
export interface NestingItem {
  id: string;
  fromMs: number;
  toMs: number | null;
}

/** An extent; a null end is open and is never invented. */
export interface NestingExtent {
  fromMs: number;
  toMs: number | null;
}

export interface CollapsedSpan extends NestingExtent {
  parent: string;
  /** Direct children present in the loaded items. */
  childCount: number;
}

export interface NestingState {
  /** Top-level collapsed parents, drawn as band-like spans. */
  collapsed: CollapsedSpan[];
  /** Item ids hidden because a collapsed parent contains them. */
  hidden: ReadonlySet<string>;
}

/** The parent's extent: the min start and max end of its children. Null when it has none. */
export function parentExtent(children: readonly NestingExtent[]): NestingExtent | null {
  if (children.length === 0) return null;
  let fromMs = Number.POSITIVE_INFINITY;
  let toMs = Number.NEGATIVE_INFINITY;
  let open = false;
  for (const child of children) {
    fromMs = Math.min(fromMs, child.fromMs);
    if (child.toMs === null) open = true;
    else toMs = Math.max(toMs, child.toMs);
  }
  return { fromMs, toMs: open ? null : toMs };
}

const NOTHING: NestingState = { collapsed: [], hidden: new Set<string>() };

function addEdge(edges: Map<string, Set<string>>, from: string, to: string): void {
  const set = edges.get(from) ?? new Set<string>();
  set.add(to);
  edges.set(from, set);
}

/** Every node reachable along `edges` from `start`. Cycle-safe. */
function reach(start: string, edges: ReadonlyMap<string, ReadonlySet<string>>): Set<string> {
  const seen = new Set<string>();
  const queue = [...(edges.get(start) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(edges.get(id) ?? []));
  }
  return seen;
}

/** Whether a parent with present children collapses at this camera. */
function collapses(childExtents: readonly NestingItem[], camera: TimeCamera, band: DensityBand): boolean {
  if (band === "marker") return true;
  const lefts = childExtents.map((child) => msToPixel(camera, child.fromMs)).sort((a, b) => a - b);
  for (let index = 1; index < lefts.length; index += 1) {
    if (lefts[index] - lefts[index - 1] < DEFAULT_TIMELINE_CARD_WIDTH_PX) return true;
  }
  return false;
}

/**
 * The nesting state of one view. Pairs whose child is not a loaded item are
 * ignored; a self-pair is ignored. A cycle collapses nothing: a parent that is
 * its own ancestor is never a top-level span, so no structure is invented.
 */
export function nestingAt(
  pairs: readonly NestingPair[],
  items: readonly NestingItem[],
  camera: TimeCamera,
  band: DensityBand,
): NestingState {
  if (pairs.length === 0 || items.length === 0) return NOTHING;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const childrenOf = new Map<string, Set<string>>();
  const parentsOf = new Map<string, Set<string>>();
  for (const { parent, child } of pairs) {
    if (parent === child || !itemById.has(child)) continue;
    addEdge(childrenOf, parent, child);
    addEdge(parentsOf, child, parent);
  }
  if (childrenOf.size === 0) return NOTHING;

  const kidsOf = (parent: string): NestingItem[] =>
    [...(childrenOf.get(parent) ?? [])].sort().map((id) => itemById.get(id)!);

  const candidates = new Set<string>();
  for (const parent of childrenOf.keys()) {
    if (collapses(kidsOf(parent), camera, band)) candidates.add(parent);
  }
  // A top-level span has no collapsing ancestor; a descendant's span is hidden with its ancestor's.
  const tops = [...candidates]
    .filter((parent) => ![...reach(parent, parentsOf)].some((ancestor) => candidates.has(ancestor)))
    .sort();

  const hidden = new Set<string>();
  const collapsed: CollapsedSpan[] = [];
  for (const parent of tops) {
    for (const id of reach(parent, childrenOf)) hidden.add(id);
    const kids = kidsOf(parent);
    const extent = parentExtent(kids);
    if (extent === null) continue;
    collapsed.push({ parent, childCount: kids.length, ...extent });
  }
  return { collapsed, hidden };
}
