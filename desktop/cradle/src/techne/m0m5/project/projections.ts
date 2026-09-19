/**
 * The M0′ Project / Wiki / Graph projections (L5 Technē, issue #213) — the
 * ONE subject/selection spine over the reading's bounded whole, projected as
 * LIST / TREE / GRAPH. Modelled on AIKit's bounded relation grammar
 * (`RelationQuery` → one `KnowledgeRelationView` shared by the List/Tree/
 * Graph presentation modes): there is no second graph substrate, store or
 * ontology here — every node and edge is the reading's own, refs verbatim.
 *
 * Laws kept here (QL-MEF wayfinder §3–§6, dual-reading lock §6, #213 §4):
 *   - ONE bounded view per query; LIST/TREE/GRAPH are projections of it, so
 *     the same native refs appear in all three and a selection survives a
 *     view switch untouched;
 *   - bounded local whole, never a hairball: expansion from the focus across
 *     the whole's relations within an explicit depth and node/edge budgets
 *     (AIKit parity: depth 1, 96 nodes, 192 edges); truncation and boundary
 *     endpoints are reported, never silently dropped;
 *   - relation vocabulary, standing, identity (relation_ref) and temporal
 *     qualification ride verbatim — nothing is relabelled or inferred;
 *   - semantic zoom is PRESENTATION: a tier narrows what is disclosed of the
 *     already-computed view; it never changes the query (AIKit: "filtering
 *     is presentation, not a second query"). Only an explicit expansion step
 *     (a new depth) is a query change;
 *   - a filesystem path IS a provider view, never the ontology: the tree
 *     projection is the relation spanning-tree from the focus, with members
 *     no relation reaches held under an explicit detached root;
 *   - pure functions, erasable TypeScript: loadable by the renderer, Vite,
 *     and `node --test`.
 */
import type {
  DisclosureSelection,
  TechneReading,
  TechneWholeRelation,
} from "../../contract.ts";

/** The three projections of the one bounded view (#213 product relation). */
export type ProjectViewMode = "list" | "tree" | "graph";

/** The semantic-zoom tiers. Presentation only — see the module header. */
export type ProjectZoomTier = "field" | "locality" | "detail";

/**
 * The bounded relation-expansion request, shared by all three projections.
 * AIKit `RelationQuery` parity: a focus, a hop depth, and non-zero budgets.
 */
export interface ProjectQuery {
  focus_ref: string;
  depth: number;
  max_nodes: number;
  max_edges: number;
}

/** AIKit parity defaults (DEFAULT_RELATION_DEPTH/NODE_BUDGET/EDGE_BUDGET). */
export const DEFAULT_PROJECT_DEPTH = 1;
export const DEFAULT_PROJECT_NODE_BUDGET = 96;
export const DEFAULT_PROJECT_EDGE_BUDGET = 192;

/**
 * One bounded relation neighbourhood computed over ONE reading's whole.
 * `boundary_refs` are relation endpoints that lie OUTSIDE the whole: named
 * honestly, never turned into members. `truncated` reports budget stops.
 */
export interface ProjectView {
  query: ProjectQuery;
  /** The whole's ref, verbatim (the subject ref when no whole is disclosed). */
  whole_ref: string;
  /** The focus is always first; then members and boundary endpoints by
   * discovery order. `member` marks whole membership — boundary endpoints
   * are not members and must never be presented as one. */
  nodes: ProjectNode[];
  /** The reading's own relations that survived the budgets, in the reading's
   * order, with their TB0 identity facets riding verbatim. */
  edges: ProjectEdge[];
  boundary_refs: string[];
  truncated: boolean;
  warnings: string[];
}

export interface ProjectNode {
  ref: string;
  /** True when the ref is a member_refs of the whole (or the whole/subject
   * itself); false for boundary endpoints reached through a relation. */
  member: boolean;
  /** Relation hops from the focus. 0 for the focus itself; null for a
   * disclosed member the bounded depth did not reach — present because the
   * whole discloses it, honestly marked as unreached. */
  distance: number | null;
}

export interface ProjectEdge {
  relation: string;
  relation_ref: string | null;
  from_ref: string;
  to_ref: string;
  origin: string | null;
  standing: string | null;
  source_ref: string | null;
  evidence_refs: string[];
  /** Real temporal qualification, verbatim; resolves against the reading's
   * temporal[]. Absent = trans-temporal — never manufactured. */
  temporal_facet_ref: string | null;
  confidence: string | null;
}

/**
 * Build the query for one reading: the focus defaults to the reading's own
 * focus_refs[0] / whole / subject; budgets refuse zero (AIKit law).
 */
export function projectQuery(reading: TechneReading, overrides: Partial<ProjectQuery> = {}): ProjectQuery {
  const defaultFocus = reading.whole?.focus_refs?.[0]
    ?? reading.whole?.whole_ref
    ?? reading.subject.subject_ref;
  const query: ProjectQuery = {
    focus_ref: overrides.focus_ref ?? defaultFocus,
    depth: overrides.depth ?? DEFAULT_PROJECT_DEPTH,
    max_nodes: overrides.max_nodes ?? DEFAULT_PROJECT_NODE_BUDGET,
    max_edges: overrides.max_edges ?? DEFAULT_PROJECT_EDGE_BUDGET,
  };
  const problems = validateQuery(query);
  if (problems.length) throw new Error(`project query drifted from the bounded-whole law: ${problems.join("; ")}`);
  return query;
}

/** Non-zero budgets and a non-empty focus, mirroring RelationQuery::validate. */
export function validateQuery(query: ProjectQuery): string[] {
  const problems: string[] = [];
  if (typeof query.focus_ref !== "string" || query.focus_ref.trim().length === 0) problems.push("focus_ref: required");
  if (!Number.isInteger(query.depth) || query.depth < 0) problems.push("depth: non-negative integer");
  if (!Number.isInteger(query.max_nodes) || query.max_nodes <= 0) problems.push("max_nodes: non-zero budget");
  if (!Number.isInteger(query.max_edges) || query.max_edges <= 0) problems.push("max_edges: non-zero budget");
  return problems;
}

function edgeOf(relation: TechneWholeRelation): ProjectEdge {
  return {
    relation: relation.relation,
    relation_ref: relation.relation_ref ?? null,
    from_ref: relation.from_ref,
    to_ref: relation.to_ref,
    origin: relation.origin ?? null,
    standing: relation.standing ?? null,
    source_ref: relation.source_ref ?? null,
    evidence_refs: [...(relation.evidence_refs ?? [])],
    temporal_facet_ref: relation.temporal_facet_ref ?? null,
    confidence: relation.confidence ?? null,
  };
}

/**
 * The ONE bounded view of a reading for a query — the shared input of all
 * three projections. Breadth-first from the focus across the whole's
 * relations (travelled in both directions: a local whole is a
 * neighbourhood, not an arrow-shape); budgets stop expansion with `truncated`
 * honesty; endpoints outside the whole are kept as boundary nodes, never
 * promoted to membership. The reading is only read, never written.
 */
export function boundedView(reading: TechneReading, query: ProjectQuery): ProjectView {
  const problems = validateQuery(query);
  if (problems.length) throw new Error(`project query drifted from the bounded-whole law: ${problems.join("; ")}`);

  const whole = reading.whole;
  const wholeRef = whole?.whole_ref ?? reading.subject.subject_ref;
  const members = new Set<string>(whole?.member_refs ?? []);
  members.add(reading.subject.subject_ref);
  members.add(wholeRef);
  const relations = (whole?.relations ?? []).map(edgeOf);
  const warnings: string[] = [];

  const nodes: ProjectNode[] = [];
  const placed = new Map<string, ProjectNode>();
  const edges: ProjectEdge[] = [];
  let truncated = false;

  const place = (ref: string, member: boolean, distance: number | null): boolean => {
    const existing = placed.get(ref);
    if (existing) {
      if (existing.distance === null || (distance !== null && distance < existing.distance)) existing.distance = distance;
      return true;
    }
    if (nodes.length >= query.max_nodes) {
      truncated = true;
      warnings.push(`node budget ${query.max_nodes} reached — the neighbourhood stays bounded`);
      return false;
    }
    const node: ProjectNode = { ref, member, distance };
    nodes.push(node);
    placed.set(ref, node);
    return true;
  };

  if (!place(query.focus_ref, members.has(query.focus_ref), 0) && query.focus_ref !== reading.subject.subject_ref) {
    warnings.push(`the focus ${query.focus_ref} exceeded the node budget`);
  }

  // Breadth-first by hop distance within the depth bound.
  let frontier = [query.focus_ref];
  let distance = 0;
  const reached = new Set<string>([query.focus_ref]);
  while (frontier.length && distance < query.depth) {
    distance += 1;
    const next: string[] = [];
    for (const relation of relations) {
      if (edges.length >= query.max_edges) { truncated = true; warnings.push(`edge budget ${query.max_edges} reached — further relations are not drawn`); break; }
      const touchesFrom = frontier.includes(relation.from_ref);
      const touchesTo = frontier.includes(relation.to_ref);
      if (!touchesFrom && !touchesTo) continue;
      // Both endpoints must be representable; the far end is placed (or the
      // edge is refused) — no invisible vertices (AIKit law).
      const farRef = touchesFrom ? relation.to_ref : relation.from_ref;
      const farIsNew = !reached.has(farRef);
      if (farIsNew) {
        if (!place(farRef, members.has(farRef), distance)) continue;
        reached.add(farRef);
        next.push(farRef);
      }
      if (edges.length >= query.max_edges) { truncated = true; warnings.push(`edge budget ${query.max_edges} reached — further relations are not drawn`); break; }
      edges.push(relation);
    }
    frontier = next;
  }

  // The whole's own membership is a disclosed fact: members the bounded
  // depth did not reach stay in the view, marked unreached — never silently
  // dropped, never promoted into the relation neighbourhood.
  for (const memberRef of members) {
    if (!placed.has(memberRef)) place(memberRef, true, null);
  }

  const boundary = nodes.filter((node) => !node.member).map((node) => node.ref);
  return { query, whole_ref: wholeRef, nodes, edges, boundary_refs: boundary, truncated, warnings };
}

/** The ref this projection family derives for a focus selection — the same
 * grammar the Canvas lane uses (`ql.techne:selection:<subject>:<focus>`), so
 * a subject opened from either instrument carries the same selection ref. */
export function projectSelectionRef(subjectRef: string, focusRef: string): string {
  return `ql.techne:selection:${subjectRef}:${focusRef}`;
}

/** A refocused selection on the SAME subject/reading basis: the M0′ click
 * model. Carries the current selection's source basis over; validates before
 * returning, so drift is refused at the model, not rendered. */
export function focusSelection(reading: TechneReading, selection: DisclosureSelection, focusRef: string): DisclosureSelection {
  if (!focusRef.trim()) throw new Error("a project focus selection carries the native ref verbatim — refusing an empty focus");
  const next: DisclosureSelection = {
    ...selection,
    selection_ref: projectSelectionRef(reading.subject.subject_ref, focusRef),
    focus_refs: [focusRef],
    instrument: "project",
  };
  return next;
}

// ---------------------------------------------------------------------------
// The three projections of the one view
// ---------------------------------------------------------------------------

export interface ProjectListRow extends ProjectNode {
  /** The relations of the view that touch this node. */
  relations: ProjectEdge[];
}

/** LIST: the view's nodes ordered by distance then ref, each with its
 * touching relations. Same refs as TREE and GRAPH — always. */
export function listProjection(view: ProjectView): ProjectListRow[] {
  const rows = view.nodes.map((node) => ({ ...node, relations: [] as ProjectEdge[] }));
  const byRef = new Map(rows.map((row) => [row.ref, row]));
  for (const edge of view.edges) {
    for (const endpoint of [edge.from_ref, edge.to_ref]) {
      const row = byRef.get(endpoint);
      if (row && !row.relations.includes(edge)) row.relations.push(edge);
    }
  }
  return rows.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
}

export interface ProjectTreeNode extends ProjectNode {
  /** The relation that reached this node, verbatim (null for the focus and
   * for detached members no relation reaches). */
  reached_by: ProjectEdge | null;
  children: ProjectTreeNode[];
}

/** TREE: the relation spanning-tree of the bounded view, grown breadth-first
 * from the focus; each node carries the relation that reached it. Members the
 * disclosed relations never reach hold under ONE explicit detached root —
 * the tree does not invent a containment relation to absorb them (a
 * filesystem tree is a provider view, never the ontology of Project). */
export function treeProjection(view: ProjectView): ProjectTreeNode {
  const byRef = new Map(view.nodes.map((node) => [node.ref, node]));
  const focus = byRef.get(view.query.focus_ref) ?? view.nodes[0];
  const root: ProjectTreeNode = { ...focus, reached_by: null, children: [] };
  const attached = new Map<string, ProjectTreeNode>([[root.ref, root]]);
  const queue: ProjectTreeNode[] = [root];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const edge of view.edges) {
      if (edge.from_ref !== parent.ref && edge.to_ref !== parent.ref) continue;
      const childRef = edge.from_ref === parent.ref ? edge.to_ref : edge.from_ref;
      if (attached.has(childRef)) continue;
      const childNode = byRef.get(childRef);
      if (!childNode) continue;
      const child: ProjectTreeNode = { ...childNode, reached_by: edge, children: [] };
      parent.children.push(child);
      attached.set(childRef, child);
      queue.push(child);
    }
  }
  const detached = view.nodes.filter((node) => !attached.has(node.ref) && node.ref !== root.ref);
  if (detached.length) {
    root.children.push(...detached.map((node) => ({ ...node, reached_by: null, children: [] })));
  }
  return root;
}

export interface GraphPoint { x: number; y: number }
export interface ProjectGraphNode extends ProjectNode {
  at: GraphPoint;
}
export interface ProjectGraphProjection {
  whole_ref: string;
  focus_ref: string;
  nodes: ProjectGraphNode[];
  edges: ProjectEdge[];
}

/** GRAPH: the same nodes/edges laid out on concentric rings per hop distance
 * from the focus (ring 0 at the centre); members the bounded depth did not
 * reach hold on one outer ring beyond the last reached distance — present,
 * honestly apart. Deterministic: ring order follows the view's discovery
 * order; angle steps are even; no clocks, no randomness. Unit space — the
 * renderer scales. Pure presentation. */
export function graphProjection(view: ProjectView): ProjectGraphProjection {
  const rings = new Map<string, ProjectNode[]>();
  for (const node of view.nodes) {
    const key = node.distance === null ? `unreached` : `d${node.distance}`;
    const ring = rings.get(key) ?? [];
    ring.push(node);
    rings.set(key, ring);
  }
  const orderedKeys = [...rings.keys()].sort((a, b) => {
    const depthOf = (key: string) => (key === "unreached" ? Infinity : Number(key.slice(1)));
    return depthOf(a) - depthOf(b);
  });
  const laidOut: ProjectGraphNode[] = [];
  let ringIndex = 0;
  for (const key of orderedKeys) {
    const ring = rings.get(key)!;
    const radius = ringIndex === 0 ? 0 : 0.32 * Math.max(1, ringIndex);
    ring.forEach((node, index) => {
      if (ringIndex === 0) {
        laidOut.push({ ...node, at: { x: 0, y: 0 } });
        return;
      }
      const angle = ((-90 + (360 / ring.length) * index) * Math.PI) / 180;
      laidOut.push({ ...node, at: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius } });
    });
    ringIndex += 1;
  }
  return { whole_ref: view.whole_ref, focus_ref: view.query.focus_ref, nodes: laidOut, edges: [...view.edges] };
}

// ---------------------------------------------------------------------------
// Semantic zoom — presentation only, never a query change
// ---------------------------------------------------------------------------

/** What a zoom tier discloses of a node. The view is already computed; a
 * tier narrows the disclosure, it never re-queries or re-expands. */
export interface ProjectTierDisclosure {
  /** Identity labels are shown from this tier up. */
  labels: boolean;
  /** Relation identity/standing/qualification from this tier up. */
  relationFacets: boolean;
  /** Only the focus and counts (the far-out view). */
  countsOnly: boolean;
}

export function tierDisclosure(tier: ProjectZoomTier): ProjectTierDisclosure {
  switch (tier) {
    case "field": return { labels: false, relationFacets: false, countsOnly: true };
    case "locality": return { labels: true, relationFacets: false, countsOnly: false };
    case "detail": return { labels: true, relationFacets: true, countsOnly: false };
  }
}
