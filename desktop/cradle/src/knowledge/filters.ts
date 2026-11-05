import type {GraphNode, GraphEdge, GraphReading} from './graph';
import {restoreEmphasisGroups, type EmphasisGroup} from './graphEmphasis';
import {isUnresolvedGraphNode, restoreGraphCamera, unresolvedAssociationsAllowed, unresolvedGraphAssociations} from './graphNavigation';
import type {Camera} from './camera';

export interface GraphFilters {
  text: string;
  scope: 'field' | 'local';
  depth: number;
  direction: 'both' | 'incoming' | 'outgoing';
  kinds: string[];
  relations: string[];
  families: string[];
  tags: string[];
  isolated: boolean;
  unresolved: boolean;
  context: 'structure' | 'matches';
  labels: 'automatic' | 'all' | 'focus';
  arrows: boolean;
  shared: boolean;
  collapsed: string[];
  emphasis: EmphasisGroup[];
  /** The most nodes that show (DLW §17.3 Budget): budgetGraph keeps them, the rest are counted. */
  budget: number;
}
/** The Knowledge graph's Budget (DLW §17.3 Parameters: 8–4096 nodes, 64 by default). */
export const GRAPH_BUDGET = Object.freeze({min: 8, max: 4096, initial: 64});
/** A Budget as the view keeps it: a whole number of nodes inside the manual's range, else the default. */
export const boundBudget = (value: unknown): number => Number.isInteger(value) ? Math.max(GRAPH_BUDGET.min, Math.min(GRAPH_BUDGET.max, value as number)) : GRAPH_BUDGET.initial;
export const defaultGraphFilters = (): GraphFilters => ({text: '', scope: 'field', depth: 1, direction: 'both', kinds: [], relations: [], families: [], tags: [], isolated: true, unresolved: true, context: 'structure', labels: 'automatic', arrows: false, shared: false, collapsed: [], emphasis: [], budget: GRAPH_BUDGET.initial});
const strings = (value: unknown, max = 64): string[] => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length <= 256))].slice(0, max) : [];
/** Decode view state, never source metadata. Invalid preferences do not make a
 * whole workspace unrestorable, and unknown keys confer no native effects. */
export function restoreGraphFilters(value: unknown): GraphFilters {
  const defaults = defaultGraphFilters();
  if (!value || typeof value !== 'object') return defaults;
  const v = value as Partial<GraphFilters>;
  return {
    text: typeof v.text === 'string' ? v.text.slice(0, 1024) : '',
    scope: v.scope === 'local' ? 'local' : 'field',
    depth: Number.isInteger(v.depth) ? Math.max(0, Math.min(8, v.depth!)) : 1,
    direction: v.direction === 'incoming' || v.direction === 'outgoing' ? v.direction : 'both',
    kinds: strings(v.kinds), relations: strings(v.relations), families: strings(v.families), tags: strings(v.tags),
    isolated: v.isolated !== false, unresolved: v.unresolved !== false, context: v.context === 'matches' ? 'matches' : 'structure',
    collapsed: Array.isArray(v.collapsed) ? [...new Set(v.collapsed.filter((ref): ref is string => typeof ref === 'string' && ref.length > 0 && ref.length <= 4096))].slice(0,256) : [],
    emphasis: restoreEmphasisGroups(v.emphasis),
    labels: v.labels === 'all' || v.labels === 'focus' ? v.labels : 'automatic', arrows: v.arrows === true, shared: v.shared === true,
    budget: boundBudget(v.budget),
  };
}
export interface FilteredGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  matches: Set<string>;
  contextual: Set<string>;
  counts: {matched: number; context: number; displayed: number; admitted: number; hidden: number};
  partialFormations: string[];
  localFocusMissing: boolean;
  collapsedSubjects: Set<string>;
  collapsedFormations: string[];
  foldedEdges: number;
}
/** What the Budget keeps of a reading, and how many subjects it leaves out. */
export interface BudgetedGraph {reading: GraphReading; shown: number; total: number; beyond: number}
/** The Budget's bound on a reading (DLW §17.3 Budget, "The graph says when it hides more"; PROJECTION-SCALE-2026-10-28 for O-I #742):
 * the `budget` subjects nearest the selected note by hops first, then the most connected, then by reference, so the same reading
 * and selection keep the same set. Every relation with a kept end stays, so a kept subject whose peers are past the Budget is no
 * orphan. Both the drawn and the simulated set are this. A reading within the Budget comes back as it is. Pure: the reading is
 * never changed, and nothing is fetched. */
export function budgetGraph(reading: GraphReading, budget: number, focus?: string): BudgetedGraph {
  const refs = new Set(reading.nodes.map(node => node.ref));
  if (refs.size <= budget) return {reading, shown: refs.size, total: refs.size, beyond: 0};
  const peers = new Map<string, Set<string>>();
  const join = (a: string, b: string) => {
    if (a === b || !refs.has(a) || !refs.has(b)) return;
    let row = peers.get(a); if (!row) peers.set(a, row = new Set()); row.add(b);
    let back = peers.get(b); if (!back) peers.set(b, back = new Set()); back.add(a);
  };
  for (const edge of reading.edges) join(edge.from_ref, edge.to_ref);
  for (const link of unresolvedGraphAssociations(reading.nodes)) join(link.source, link.ghost);
  const hops = new Map<string, number>();
  if (focus && refs.has(focus)) {
    hops.set(focus, 0);
    let frontier = [focus];
    for (let hop = 1; frontier.length; hop++) {
      const next: string[] = [];
      for (const from of frontier) for (const to of peers.get(from) ?? []) if (!hops.has(to)) { hops.set(to, hop); next.push(to); }
      frontier = next;
    }
  }
  const far = (ref: string) => hops.get(ref) ?? Infinity;
  const ranked = [...refs].sort((a, b) => (far(a) === far(b) ? 0 : far(a) - far(b)) || (peers.get(b)?.size ?? 0) - (peers.get(a)?.size ?? 0) || a.localeCompare(b));
  const kept = new Set(ranked.slice(0, budget));
  return {
    reading: {...reading, nodes: reading.nodes.filter(node => kept.has(node.ref)), edges: reading.edges.filter(edge => kept.has(edge.from_ref) || kept.has(edge.to_ref))},
    shown: kept.size, total: refs.size, beyond: refs.size - kept.size,
  };
}

/** Filters operate on an ALREADY admitted owner reading. They never fetch
 * hidden members or invent edges, roles, QL classification or hierarchy. */
export function filterGraph(reading: GraphReading, filters: GraphFilters, focus?: string): FilteredGraph {
  const byRef = new Map(reading.nodes.map(node => [node.ref, node]));
  const degree = new Set<string>();
  const traversable = new Map<string, string[]>();
  const allowedEdge = (edge: GraphEdge) => (filters.relations.length === 0 || filters.relations.includes(edge.relation)) && (!filters.families?.length || filters.families.includes(edge.family ?? 'native-semantic'));
  const add = (from: string, to: string) => {
    if (!byRef.has(from) || !byRef.has(to)) return;
    const row = traversable.get(from) ?? [];
    row.push(to); traversable.set(from, row);
  };
  for (const edge of reading.edges) {
    // Count admitted incident assertions even when a target is outside this
    // bounded reading. Filtered-out neighbours do not turn a node into an orphan.
    // A3 self-loops remain native edges but do not connect a subject to a peer.
    if (edge.from_ref !== edge.to_ref) {degree.add(edge.from_ref); degree.add(edge.to_ref);}
    if (!allowedEdge(edge)) continue;
    if (filters.direction !== 'incoming') add(edge.from_ref, edge.to_ref);
    if (filters.direction !== 'outgoing') add(edge.to_ref, edge.from_ref);
  }
  // View-only phantom links participate in local scope, never the native edge
  // result. Their sources are already exact refs from the owner's link cache.
  if (unresolvedAssociationsAllowed(filters)) {
    for (const link of unresolvedGraphAssociations(reading.nodes)) {
      degree.add(link.source); degree.add(link.ghost);
      if (filters.direction !== 'incoming') add(link.source, link.ghost);
      if (filters.direction !== 'outgoing') add(link.ghost, link.source);
    }
  }
  const localFocusMissing = filters.scope === 'local' && (!focus || !byRef.has(focus));
  let scope = new Set(byRef.keys());
  if (filters.scope === 'local') {
    scope = new Set<string>();
    if (!localFocusMissing) {
      scope.add(focus!);
      let frontier = [focus!];
      for (let hop = 0; hop < filters.depth && frontier.length; hop++) {
        const next: string[] = [];
        for (const from of frontier) for (const to of traversable.get(from) ?? []) if (!scope.has(to)) { scope.add(to); next.push(to); }
        frontier = next;
      }
    }
  }
  const needle = filters.text.trim().toLocaleLowerCase();
  const matches = new Set<string>();
  for (const [ref, node] of byRef) {
    if (isUnresolvedGraphNode(node) && !filters.unresolved) continue;
    if (!scope.has(ref) || (!filters.isolated && !degree.has(ref))) continue;
    if (filters.kinds.length && !filters.kinds.includes(node.kind)) continue;
    if (filters.tags.length && !filters.tags.every(tag => node.tags?.includes(tag))) continue;
    if (needle && ![node.label, node.ref, ...(node.aliases ?? [])].some(text => text.toLocaleLowerCase().includes(needle))) continue;
    matches.add(ref);
  }
  const shown = new Set(matches);
  if (filters.context === 'structure') {
    // Exactly one containing formation disclosure, not recursive graph closure.
    // Native recursive/nested wholes remain explicitly expandable by the owner.
    for (const formation of reading.formations ?? []) {
      if (!matches.has(formation.ref) && !formation.members.some(member => matches.has(member.ref))) continue;
      if (byRef.has(formation.ref)) shown.add(formation.ref);
      for (const member of formation.members) if (byRef.has(member.ref)) shown.add(member.ref);
    }
  }
  // Collapse is disclosure, not a new semantic whole or a surrogate edge.
  // A shared member stays visible when another displayed containing whole is
  // open; selection is never hidden by a view preference. Source vertices not
  // participating in a folded formation remain independently accessible.
  const collapsed = new Set(filters.collapsed ?? []);
  const folded = new Set<string>(), protectedMembers = new Set<string>();
  const collapsedFormations: string[] = [];
  for (const formation of reading.formations ?? []) {
    if (!shown.has(formation.ref)) continue;
    if (collapsed.has(formation.ref)) {
      collapsedFormations.push(formation.ref);
      for (const member of formation.members) if (shown.has(member.ref) && member.ref !== formation.ref) folded.add(member.ref);
    } else {
      for (const member of formation.members) protectedMembers.add(member.ref);
    }
  }
  const collapsedSubjects = new Set([...folded].filter(ref => ref !== focus && !protectedMembers.has(ref)));
  for (const ref of collapsedSubjects) shown.delete(ref);
  const foldedEdges = reading.edges.filter(edge => allowedEdge(edge) &&
    (collapsedSubjects.has(edge.from_ref) || collapsedSubjects.has(edge.to_ref))).length;
  const contextual = new Set([...shown].filter(ref => !matches.has(ref)));
  const partialFormations = (reading.formations ?? []).filter(formation => {
    const displayed = formation.members.filter(member => shown.has(member.ref));
    return !collapsed.has(formation.ref) && (displayed.length > 0 || shown.has(formation.ref)) && (formation.partial === true || displayed.length < formation.members.length);
  }).map(formation => formation.ref);
  const nodes = [...byRef.values()].filter(node => shown.has(node.ref));
  const edges = reading.edges.filter(edge => shown.has(edge.from_ref) && shown.has(edge.to_ref) && allowedEdge(edge));
  return {nodes, edges, matches, contextual, counts: {matched: matches.size, context: contextual.size, displayed: shown.size, admitted: byRef.size, hidden: byRef.size - shown.size}, partialFormations, localFocusMissing, collapsedSubjects, collapsedFormations, foldedEdges};
}

export interface SavedGraphView {name: string; filters: GraphFilters; camera?: Camera; focus?: string}
export function captureSavedGraphView(name: string, filters: GraphFilters, camera: Camera, focus?: string): SavedGraphView {
  const restored = restoreGraphCamera(camera);
  if (!restored) throw Error('Save a graph view with a finite camera.');
  return {name: name.trim().slice(0, 80), filters: restoreGraphFilters(structuredClone(filters)), camera: restored, ...(focus ? {focus} : {})};
}
export function restoreSavedGraphViews(value: unknown): SavedGraphView[] {
  if (!Array.isArray(value)) return [];
  const names = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item.name !== 'string') return [];
    const name = item.name.trim().slice(0, 80);
    if (!name || names.has(name)) return [];
    names.add(name);
    const camera = restoreGraphCamera(item.camera);
    const focus = typeof item.focus === 'string' && item.focus.length > 0 ? item.focus : undefined;
    return [{name, filters: restoreGraphFilters(item.filters), ...(camera ? {camera, ...(focus ? {focus} : {})} : {})}];
  }).slice(0, 12);
}
