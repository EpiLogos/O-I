import type {GraphNode, GraphEdge, GraphReading} from './graph';
import {restoreEmphasisGroups, type EmphasisGroup} from './graphEmphasis';

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
  context: 'structure' | 'matches';
  labels: 'automatic' | 'all' | 'focus';
  arrows: boolean;
  shared: boolean;
  collapsed: string[];
  emphasis: EmphasisGroup[];
}
export const defaultGraphFilters = (): GraphFilters => ({text: '', scope: 'field', depth: 1, direction: 'both', kinds: [], relations: [], families: [], tags: [], isolated: true, context: 'structure', labels: 'automatic', arrows: false, shared: false, collapsed: [], emphasis: []});
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
    isolated: v.isolated !== false, context: v.context === 'matches' ? 'matches' : 'structure',
    collapsed: Array.isArray(v.collapsed) ? [...new Set(v.collapsed.filter((ref): ref is string => typeof ref === 'string' && ref.length > 0 && ref.length <= 4096))].slice(0,256) : [],
    emphasis: restoreEmphasisGroups(v.emphasis),
    labels: v.labels === 'all' || v.labels === 'focus' ? v.labels : 'automatic', arrows: v.arrows === true, shared: v.shared === true,
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
    degree.add(edge.from_ref); degree.add(edge.to_ref);
    if (!allowedEdge(edge)) continue;
    if (filters.direction !== 'incoming') add(edge.from_ref, edge.to_ref);
    if (filters.direction !== 'outgoing') add(edge.to_ref, edge.from_ref);
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

export interface SavedGraphView {name: string; filters: GraphFilters}
export function restoreSavedGraphViews(value: unknown): SavedGraphView[] {
  if (!Array.isArray(value)) return [];
  const names = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item.name !== 'string') return [];
    const name = item.name.trim().slice(0, 80);
    if (!name || names.has(name)) return [];
    names.add(name);
    return [{name, filters: restoreGraphFilters(item.filters)}];
  }).slice(0, 12);
}
