import type {Camera} from './camera';
import {unaccommodate} from './camera';
import type {GraphFilters, SavedGraphView} from './filters';
import type {GraphNode, GraphReading} from './graph';
import type {KnowledgeAddress} from '../kernel/types';
import type {WikiAnchor} from './wikiDocument';

/** Presentation travel carries exact native references, never source content. */
export interface GraphVisit {
  query: string;
  selected?: string;
  camera: Camera;
  overviewCamera?: Camera;
  filters?: GraphFilters;
  pageAddress?: KnowledgeAddress;
  pageTitle?: string;
  pageAnchor?: WikiAnchor;
  scroll?: number;
  detail?: boolean;
  detailReturn?: GraphReturnVisit;
}
export type GraphReturnVisit = Omit<GraphVisit, 'detail' | 'detailReturn'>;

export function restoreGraphCamera(value: unknown): Camera | undefined {
  if (!value || typeof value !== 'object') return;
  const camera = value as Camera;
  if (![camera.zoom, camera.x, camera.y].every(Number.isFinite) || camera.zoom < .15 || camera.zoom > 4) return;
  return {zoom: camera.zoom, x: camera.x, y: camera.y};
}
/** A saved camera is the rendered viewport, independent of selected-subject
 * accommodation. Legacy filter-only views keep their existing camera/focus. */
export function applySavedGraphView(visit: GraphVisit, saved: SavedGraphView, geometry?: {point: {x: number; y: number}; extent: {width: number; height: number}}): GraphVisit {
  const next = {...structuredClone(visit), filters: structuredClone(saved.filters)};
  const camera = restoreGraphCamera(saved.camera);
  if (!camera) return next;
  const selected = saved.focus;
  const restored = selected && geometry ? unaccommodate(camera, geometry.point, {x: 0, y: 0, ...geometry.extent}, geometry.extent) : camera;
  return {...next, camera: restored, selected, overviewCamera: undefined, detail: false,
    detailReturn: undefined, pageAddress: undefined, pageTitle: undefined, pageAnchor: undefined, scroll: undefined};
}

export type UnresolvedGraphNode = GraphNode & {unresolved: {key: string; sources: Record<string, number>}};
export function isUnresolvedGraphNode(node: GraphNode): node is UnresolvedGraphNode {
  return node.kind === 'unresolved-link' && node.native_owner === 'graph-presentation' && 'unresolved' in node;
}
/** A3 phantom nodes are presentation only. The owner's native edge array and
 * source counts stay intact; already-normalized keys are never parsed again. */
export function projectUnresolvedGraph(reading: GraphReading): GraphReading {
  const keys = new Map<string, UnresolvedGraphNode>();
  const refs = new Set(reading.nodes.map(node => node.ref));
  for (const link of reading.unresolved_links ?? []) {
    let ghost = keys.get(link.key);
    if (!ghost) {
      let ref = `view:unresolved-link:${encodeURIComponent(link.key)}`;
      while (refs.has(ref)) ref += ':view';
      refs.add(ref);
      ghost = {ref, kind: 'unresolved-link', label: link.key, native_owner: 'graph-presentation',
        provenance: structuredClone(link.provenance), actions: [], unresolved: {key: link.key, sources: {}}};
      keys.set(link.key, ghost);
    }
    // Repeated input disclosures must not multiply a source occurrence count.
    for (const [source, count] of Object.entries(link.sources)) if (Number.isInteger(count) && count > 0) {
      ghost.unresolved.sources[source] = Math.max(ghost.unresolved.sources[source] ?? 0, count);
    }
  }
  return {...reading, nodes: [...reading.nodes, ...keys.values()]};
}
/** These are disclosed unresolved source associations, not GraphEdges. Missing
 * sources remain in ghost disclosure but never acquire fabricated endpoints. */
export function unresolvedGraphAssociations(nodes: GraphNode[]) {
  const refs = new Set(nodes.filter(node => !isUnresolvedGraphNode(node)).map(node => node.ref));
  return nodes.flatMap(node => isUnresolvedGraphNode(node)
    ? Object.entries(node.unresolved.sources).filter(([source]) => refs.has(source))
      .map(([source, occurrences]) => ({source, ghost: node.ref, occurrences})) : []);
}
export function unresolvedAssociationsAllowed(filters: GraphFilters) {
  return filters.unresolved && (!filters.relations.length || filters.relations.includes('wiki-link')) &&
    (!filters.families.length || filters.families.includes('native-semantic'));
}

function graphReturn(visit: GraphVisit): GraphReturnVisit {
  const {detail: _detail, detailReturn: _return, ...graph} = visit;
  return structuredClone(graph);
}
export function selectGraphVisit(visit: GraphVisit, reference: string): GraphVisit {
  if (!reference) throw Error('Select an addressed graph subject.');
  const graph = visit.detailReturn ?? graphReturn(visit);
  return {...structuredClone(graph), selected: reference, overviewCamera: graph.overviewCamera ?? {...graph.camera}};
}
export function openGraphVisit(visit: GraphVisit, reference: string): GraphVisit {
  if (!reference) throw Error('Open an addressed graph subject.');
  return {...structuredClone(visit), selected: reference, detail: true,
    detailReturn: structuredClone(visit.detailReturn ?? graphReturn(visit)),
    pageAddress: undefined, pageTitle: undefined, pageAnchor: undefined, scroll: undefined,
    overviewCamera: visit.overviewCamera ?? {...visit.camera},
    camera: {...visit.camera, zoom: Math.max(.75, visit.camera.zoom), x: 0, y: 0}};
}
export function returnGraphVisit(visit: GraphVisit): GraphVisit {
  if (visit.detailReturn) return structuredClone(visit.detailReturn);
  const graph = graphReturn(visit);
  return {...graph, selected: undefined, camera: {...(graph.overviewCamera ?? graph.camera)}, overviewCamera: undefined};
}
export function appendGraphVisit<T extends {visits: GraphVisit[]; index: number}>(travel: T, visit: GraphVisit): T {
  const visits = [...travel.visits.slice(0, travel.index + 1), structuredClone(visit)].slice(-32);
  return {...travel, visits, index: visits.length - 1};
}
export function restoreGraphReturn(value: unknown): GraphReturnVisit | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const visit = value as GraphVisit;
  const camera = (v: Camera | undefined) => !!v && [v.zoom, v.x, v.y].every(Number.isFinite) && v.zoom >= .15 && v.zoom <= 4;
  if (typeof visit.query !== 'string' || !camera(visit.camera) || visit.overviewCamera && !camera(visit.overviewCamera)
    || visit.selected !== undefined && typeof visit.selected !== 'string') return;
  const result = graphReturn(visit);
  if (result.pageAddress && (!['source', 'wiki', 'project-map'].includes(result.pageAddress.kind) || typeof result.pageAddress.value !== 'string')) delete result.pageAddress;
  if (result.pageTitle !== undefined && typeof result.pageTitle !== 'string') delete result.pageTitle;
  if (result.scroll !== undefined && (!Number.isFinite(result.scroll) || result.scroll < 0)) delete result.scroll;
  return result;
}
/** All updates use the captured origin. Repeated pointer events at the same
 * screen coordinate must not accumulate the full displacement again. */
export function graphDragPosition(origin: {x: number; y: number}, displacement: {x: number; y: number}, zoom: number) {
  if (![origin.x, origin.y, displacement.x, displacement.y, zoom].every(Number.isFinite) || zoom <= 0) throw Error('A graph drag needs a finite captured camera.');
  return {x: origin.x + displacement.x / zoom, y: origin.y + displacement.y / zoom};
}
