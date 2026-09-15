import {createExploreEntry} from './explore.mjs';
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
  const degraded = detail => Object.freeze({schema:KNOWLEDGE_ENCOUNTER_SCHEMA,state:'degraded',focus,resource:clone(resource),detail,nodes:[clone(resource)],edges:[],presentations:['page'],actions:clone(opened.actions??[]),sources:clone(opened.sources)});
  if (!relations || relations.error) return degraded(String(relations?.error ?? 'The relation owner did not return a local whole.'));
  try {
  record(relations, 'Explore open reading.relations');
  if (relations.schema !== 'oi.explore-relation-view/v1') throw new TypeError(`Unsupported relation view schema: ${relations.schema}`);
  if (relations.focus !== focus) throw new TypeError('Relation view focus must equal the opened semantic ref');
  if (!Array.isArray(relations.nodes) || !Array.isArray(relations.edges)) throw new TypeError('Relation view nodes and edges must be arrays');
  const nodes = relations.nodes.slice(0, 24).map((node, index) => {
    record(node, `relation node[${index}]`);
    text(node.ref, `relation node[${index}].ref`);
    if (!Array.isArray(node.provenance) || node.provenance.length === 0) throw new TypeError(`relation node[${index}].provenance must be non-empty`);
    return {...createExploreEntry(node), ...(node.availability ? {availability:node.availability} : {})};
  });
  const refs = new Set(nodes.map(node => node.ref));
  if (!refs.has(focus)) throw new TypeError('Relation view does not contain its focus node');
  if (nodes.find(node=>node.ref===focus).revision !== resource.revision) throw new TypeError('Relation focus revision differs from the opened source revision');
  if (refs.size !== nodes.length) throw new TypeError('Relation view contains duplicate semantic refs');
  let truncated = Boolean(relations.truncated) || relations.nodes.length > 24 || relations.edges.length > 48;
  const edges = relations.edges.slice(0, 48).flatMap((edge, index) => {
    record(edge, `relation edge[${index}]`);
    text(edge.from, `relation edge[${index}].from`);
    text(edge.to, `relation edge[${index}].to`);
    text(edge.relation, `relation edge[${index}].relation`);
    text(edge.origin, `relation edge[${index}].origin`);
    if (!Array.isArray(edge.provenance) || edge.provenance.length === 0) throw new TypeError(`relation edge[${index}].provenance must be non-empty`);
    for (const row of edge.provenance) { text(row.ref,'relation source ref'); text(row.kind,'relation source kind'); text(row.source_system,'relation source owner'); if(row.revision!==undefined)text(row.revision,'relation source revision'); }
    const missing=[...new Set([edge.from,edge.to])].filter(ref=>!refs.has(ref));
    if(nodes.length+missing.length>24){truncated=true;return [];}
    // A disclosed relation can outlive availability of one endpoint. Preserve
    // that exact semantic address and provenance as an unavailable endpoint;
    // never drop the relation or manufacture a replacement neighbour.
    for (const endpoint of [edge.from, edge.to]) {
      if (refs.has(endpoint)) continue;
      refs.add(endpoint);
      nodes.push({ref:endpoint,kind:'unavailable',world_ref:resource.world_ref,label:endpoint,availability:'unavailable',aliases:[],locators:[],provenance:clone(edge.provenance)});
    }
    return [clone(edge)];
  });
  const presentations = [...KNOWLEDGE_PRESENTATIONS];
  return Object.freeze({
    schema: KNOWLEDGE_ENCOUNTER_SCHEMA,
    state: 'available',
    focus,
    resource: clone(resource),
    depth: relations.depth,
    budget: relations.budget,
    truncated,
    nodes,
    edges,
    presentations,
    actions: clone(opened.actions ?? []),
    sources: clone(opened.sources),
  });
  } catch(error) { return degraded(String(error instanceof Error ? error.message : error)); }
}
