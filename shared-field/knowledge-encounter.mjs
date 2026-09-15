export const KNOWLEDGE_ENCOUNTER_SCHEMA = 'oi.knowledge-encounter/v1';
export const KNOWLEDGE_PRESENTATIONS = Object.freeze(['graph', 'tree', 'list', 'page', 'expression']);

const clone = value => value === undefined ? undefined : structuredClone(value);
const record = (value, name) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
};
const text = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be non-empty text`);
  return value;
};

/**
 * Turn the owner-backed Explore open reading into the one bounded local whole
 * consumed by browser, desktop and structured Agent surfaces. This function
 * never expands the graph: every node and edge must already be in the owner's
 * admitted relation view.
 */
export function createKnowledgeEncounter(opened) {
  record(opened, 'Explore open reading');
  const resource = record(opened.resource, 'Explore open reading.resource');
  const focus = text(resource.ref, 'Explore open reading.resource.ref');
  const relations = opened.relations;
  if (!relations || relations.error) {
    return Object.freeze({
      schema: KNOWLEDGE_ENCOUNTER_SCHEMA,
      state: 'degraded',
      focus,
      resource: clone(resource),
      detail: String(relations?.error ?? 'The relation owner did not return a local whole.'),
      nodes: [clone(resource)],
      edges: [],
      presentations: ['page'],
      actions: clone(opened.actions ?? []),
      sources: clone(opened.sources),
    });
  }
  record(relations, 'Explore open reading.relations');
  if (relations.schema !== 'oi.explore-relation-view/v1') throw new TypeError(`Unsupported relation view schema: ${relations.schema}`);
  if (relations.focus !== focus) throw new TypeError('Relation view focus must equal the opened semantic ref');
  if (!Array.isArray(relations.nodes) || !Array.isArray(relations.edges)) throw new TypeError('Relation view nodes and edges must be arrays');
  const nodes = relations.nodes.map((node, index) => {
    record(node, `relation node[${index}]`);
    text(node.ref, `relation node[${index}].ref`);
    if (!Array.isArray(node.provenance) || node.provenance.length === 0) throw new TypeError(`relation node[${index}].provenance must be non-empty`);
    return clone(node);
  });
  const refs = new Set(nodes.map(node => node.ref));
  if (!refs.has(focus)) throw new TypeError('Relation view does not contain its focus node');
  if (refs.size !== nodes.length) throw new TypeError('Relation view contains duplicate semantic refs');
  const edges = relations.edges.map((edge, index) => {
    record(edge, `relation edge[${index}]`);
    text(edge.from, `relation edge[${index}].from`);
    text(edge.to, `relation edge[${index}].to`);
    text(edge.relation, `relation edge[${index}].relation`);
    text(edge.origin, `relation edge[${index}].origin`);
    if (!Array.isArray(edge.provenance) || edge.provenance.length === 0) throw new TypeError(`relation edge[${index}].provenance must be non-empty`);
    // A disclosed relation can outlive availability of one endpoint. Preserve
    // that exact semantic address and provenance as an unavailable endpoint;
    // never drop the relation or manufacture a replacement neighbour.
    for (const endpoint of [edge.from, edge.to]) {
      if (refs.has(endpoint)) continue;
      refs.add(endpoint);
      nodes.push({ref:endpoint,kind:'unavailable',world_ref:resource.world_ref,label:endpoint,availability:'unavailable',aliases:[],locators:[],provenance:clone(edge.provenance)});
    }
    return clone(edge);
  });
  const presentations = [...KNOWLEDGE_PRESENTATIONS];
  return Object.freeze({
    schema: KNOWLEDGE_ENCOUNTER_SCHEMA,
    state: 'available',
    focus,
    resource: clone(resource),
    depth: relations.depth,
    budget: relations.budget,
    truncated: Boolean(relations.truncated),
    nodes,
    edges,
    presentations,
    actions: clone(opened.actions ?? []),
    sources: clone(opened.sources),
  });
}

export function createKnowledgeTravel(focus) {
  text(focus, 'knowledge focus');
  return {schema:'oi.knowledge-travel/v1', visits:[focus], index:0, pinned:[], follow:true, presentation:'graph'};
}

export function recenterKnowledge(travel, encounter, ref) {
  record(travel, 'knowledge travel'); record(encounter, 'knowledge encounter'); text(ref, 'recenter ref');
  const target=encounter.nodes.find(node => node.ref === ref);
  if (!target) throw new RangeError(`Cannot recenter outside the bounded local whole: ${ref}`);
  if (target.availability === 'unavailable') throw new RangeError(`Cannot recenter to unavailable relation endpoint: ${ref}`);
  if (travel.visits[travel.index] === ref) return clone(travel);
  return {...clone(travel), visits:[...travel.visits.slice(0, travel.index + 1), ref], index:travel.index + 1};
}

export function travelKnowledge(travel, delta) {
  record(travel, 'knowledge travel');
  const index = Math.max(0, Math.min(travel.visits.length - 1, travel.index + delta));
  return {...clone(travel), index};
}

export function setKnowledgePresentation(travel, presentation) {
  if (!KNOWLEDGE_PRESENTATIONS.includes(presentation)) throw new RangeError(`Unsupported knowledge presentation: ${presentation}`);
  return {...clone(travel), presentation};
}

export function toggleKnowledgePin(travel, ref) {
  text(ref, 'pin ref');
  const pinned = new Set(travel.pinned ?? []);
  pinned.has(ref) ? pinned.delete(ref) : pinned.add(ref);
  return {...clone(travel), pinned:[...pinned]};
}

export function toggleKnowledgeFollow(travel) {
  return {...clone(travel), follow:!travel.follow};
}
