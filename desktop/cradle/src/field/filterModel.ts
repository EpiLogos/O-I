/**
 * ONE filter model, ONE neighbourhood.
 *
 * The graph and the connections list are two accounts of the same thing — what surrounds the page
 * the reader stands on — so both are computed here, from the same `FieldFilter`, and neither guesses
 * a list of its own. "Here" in the Library view uses the same neighbourhood too.
 *
 * Pure: depends only on the corpus index.
 */
import type {FieldRef, FieldFilter} from "./model";
import type {CorpusIndex} from "./corpusIndex";

export interface Neighbourhood {
  out: FieldRef[]; in: FieldRef[]; all: FieldRef[];
  /** Everything before the group filter (so the list can say how many are filtered out). */
  raw: FieldRef[];
}

export const filtersActive = (f: FieldFilter) => f.hidden.length > 0 || f.hubs || f.depth > 1;

export function neighbourhood(index: CorpusIndex, focus: FieldRef, filter: FieldFilter): Neighbourhood {
  const hidden = new Set(filter.hidden);
  const allowed = (r: FieldRef) => !hidden.has(index.node(r)?.group ?? "");
  const nb = index.neighbours(focus, filter.hubs);
  return {out: nb.out.filter(allowed), in: nb.in.filter(allowed), all: nb.all.filter(allowed), raw: nb.all};
}

export interface GraphPlan {
  direct: FieldRef[];
  second: { ref: FieldRef; parent: FieldRef; depth: number }[];
  nb: Neighbourhood;
}

/** What the graph draws: the page, its neighbours (capped to what the pane can carry, busiest first), and — by
 * reach — theirs. `area` is the pane's pixel area; a compact sidebar draws fewer nodes than a wide one. */
export function planGraph(index: CorpusIndex, focus: FieldRef, filter: FieldFilter, area: number, override?: FieldRef[] | null): GraphPlan {
  const nb = neighbourhood(index, focus, filter);
  if (override) return {direct: override.slice(1), second: [], nb: {...nb, out: [], in: [], all: override.slice(1)}};
  const hidden = new Set(filter.hidden);
  const allowed = (r: FieldRef) => !hidden.has(index.node(r)?.group ?? "");
  const cap = Math.max(12, Math.min(36, Math.round(area / 6000)));
  const order = new Map(index.nodes.map((n, i) => [n.ref, i]));
  const byIndex = (a: FieldRef, b: FieldRef) => order.get(a)! - order.get(b)!;
  const direct = nb.all.slice().sort((a, b) => index.degree(b) - index.degree(a)).slice(0, cap).sort(byIndex);
  const seen = new Set<FieldRef>([focus, ...direct]);
  const second: GraphPlan["second"] = [];
  let frontier = direct;
  for (let lvl = 2; lvl <= Math.min(3, filter.depth); lvl++) {
    const next: GraphPlan["second"] = [], room = lvl === 2 ? 36 : 28;
    for (const j of frontier.slice().sort((a, b) => index.degree(b) - index.degree(a)).slice(0, lvl === 2 ? 16 : 10)) {
      for (const k of index.neighbours(j, filter.hubs).all) if (!seen.has(k) && allowed(k) && next.length < room) { seen.add(k); next.push({ref: k, parent: j, depth: lvl}); }
    }
    second.push(...next); frontier = next.map(s => s.ref);
  }
  return {direct, second, nb};
}

/** Connections grouped by register/group, in the index's group order — the list under the graph. */
export function groupConnections(index: CorpusIndex, nb: Neighbourhood) {
  const groups: Record<string, FieldRef[]> = {};
  for (const r of nb.all) (groups[index.node(r)!.group] ??= []).push(r);
  const order = new Map(index.nodes.map((n, i) => [n.ref, i]));
  return index.groups.filter(g => groups[g.id]).map(g => ({group: g, refs: groups[g.id].sort((a, b) => order.get(a)! - order.get(b)!)}));
}

/** "Here" in the Library: Expressions about the page and about what the graph shows around it (hubs left out). */
export function hereExpressions(index: CorpusIndex, focus: FieldRef | null | undefined): Set<FieldRef> {
  const ids = new Set<FieldRef>();
  if (focus == null) return ids;
  for (const r of [focus, ...index.neighbours(focus, false).all]) for (const x of index.expressionsOf(r)) ids.add(x);
  return ids;
}

/** The refs the explorer, graph and Library treat as "the locus": a sequence page at a position stands on that position's page. */
export function locusRef(index: CorpusIndex, ref: FieldRef, span?: string): FieldRef { return index.focusFor(ref, span); }
