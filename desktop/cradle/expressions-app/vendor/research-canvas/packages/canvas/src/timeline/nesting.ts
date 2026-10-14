/**
 * lane-2 T9 — nested events with zoom-collapsing structure (pure).
 *
 * A parent event holds child events through the explicit containment pairs the
 * host supplies — the authority's `part` family (PART_OF / CONTAINS and their
 * kin, explicit verbs only) through `containmentPairs` (lane-2 T9b). This module
 * reads the pairs it is given and invents none.
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

/**
 * Explicit containment: `child` sits inside `parent`. `dated` is true when the
 * reading dates the child. A dated child the view has not loaded (outside the
 * loaded window or the shared time window) is missing from the parent's extent,
 * so that parent does not collapse: its span would be measured from part of its
 * children and its count would undercount (lane-2 T9, bounded loading).
 */
export interface NestingPair {
  parent: string;
  child: string;
  dated?: boolean;
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
  // Children that start at the same instant never separate by zooming (they stack), so they do not hold the parent closed:
  // only distinct starts are measured.
  const lefts = [...new Set(childExtents.map((child) => child.fromMs))].map((fromMs) => msToPixel(camera, fromMs)).sort((a, b) => a - b);
  for (let index = 1; index < lefts.length; index += 1) {
    if (lefts[index] - lefts[index - 1] < DEFAULT_TIMELINE_CARD_WIDTH_PX) return true;
  }
  return false;
}

/**
 * The label of a collapsed parent: its title and the count of the children it
 * collapses over (the children the chips show, see `chipHidden`).
 */
export function collapsedSpanLabel(title: string, childCount: number): string {
  return `${title} · ${childCount} ${childCount === 1 ? "item" : "items"}`;
}

const NO_CHIP_HIDDEN: ReadonlySet<string> = new Set<string>();

/**
 * The nesting state of one view. Pairs whose child is not a loaded item are
 * ignored; a self-pair is ignored. A cycle collapses nothing: a parent that is
 * its own ancestor is never a top-level span, so no structure is invented.
 *
 * `chipHidden` names items the category chips hide. A hidden child neither
 * counts toward its parent's count or extent nor keeps the parent expanded; a
 * hidden parent never collapses, since its span would hide children the chips
 * show. Only a dated child that is loaded-absent holds a parent open.
 */
export function nestingAt(
  pairs: readonly NestingPair[],
  items: readonly NestingItem[],
  camera: TimeCamera,
  band: DensityBand,
  chipHidden: ReadonlySet<string> = NO_CHIP_HIDDEN,
): NestingState {
  if (pairs.length === 0 || items.length === 0) return NOTHING;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const childrenOf = new Map<string, Set<string>>();
  const parentsOf = new Map<string, Set<string>>();
  for (const { parent, child } of pairs) {
    if (parent === child || !itemById.has(child)) continue;
    if (chipHidden.has(parent) || chipHidden.has(child)) continue;
    addEdge(childrenOf, parent, child);
    addEdge(parentsOf, child, parent);
  }
  if (childrenOf.size === 0) return NOTHING;

  // A parent with a dated child the view has not loaded is incomplete: its extent is not known, so it stays expanded.
  const incomplete = new Set<string>();
  for (const { parent, child, dated } of pairs) {
    if (parent === child || chipHidden.has(parent) || chipHidden.has(child)) continue;
    if (dated === true && !itemById.has(child)) incomplete.add(parent);
  }

  const kidsOf = (parent: string): NestingItem[] =>
    [...(childrenOf.get(parent) ?? [])].sort().map((id) => itemById.get(id)!);

  const candidates = new Set<string>();
  for (const parent of childrenOf.keys()) {
    if (!incomplete.has(parent) && collapses(kidsOf(parent), camera, band)) candidates.add(parent);
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
