// The knowledge graph face bodies' acts and the domains the rows declare (knowledgeGraphFaceBodies.tsx, agentNativeP0.ts,
// shellSetterBridge.ts). Pure: no React, no DOM. Each act calls the surface's own handle (the cradle's
// KnowledgeGraphSurface), which the open surface implements over its own filter state and camera. No act keeps a copy.
//
// The vocabularies are the owner's declared choices, as the cradle names them: the scope, direction, context and label
// rules the panel offers; the node kinds the graph's types name (GraphNode.kind, including the unresolved-link markers the
// graph creates for ghosts); the four native relation spellings (GraphEdge.relation). The reading's own kinds and
// relations are open: the writers check each name against the open reading too, and refuse what it does not hold.

import type {KnowledgeGraphSurface} from '../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import {GRAPH_ZOOM_LIMITS} from '../../../../../desktop/cradle/src/knowledge/camera'

export const KNOWLEDGE_SCOPES = ['field', 'local'] as const
export const KNOWLEDGE_DIRECTIONS = ['both', 'outgoing', 'incoming'] as const
export const KNOWLEDGE_CONTEXTS = ['structure', 'matches'] as const
export const KNOWLEDGE_LABELS = ['automatic', 'all', 'focus'] as const

/** The node kinds the cradle declares: the native owner's kinds, the Shared Field's hosted kinds, and the unresolved-link
 * markers the graph draws for ghosts. */
export const KNOWLEDGE_KINDS: readonly string[] = [
  'wiki-space', 'wiki-node', 'file', 'flow', 'skill', 'knowledge-subject',
  'hosted-central-world', 'hosted-wiki-space', 'hosted-wiki-node', 'hosted-curated-artifact', 'hosted-contribution',
  'unresolved-link',
]

/** The four native relation spellings (the owner's wiki relations). Hosted Explore relations arrive verbatim and are not
 * declared here; the ticket's OPEN list names them. */
export const KNOWLEDGE_RELATIONS: readonly string[] = ['space-child-space', 'space-node', 'node-space', 'node-source']

/** The depth input clamps to these (GraphFilters.tsx: min 0, max 8). */
export const DEPTH_RANGE = {min: 0, max: 8} as const
/** The zoom buttons and slider clamp to the graph's one zoom grammar (knowledge/camera.ts GRAPH_ZOOM_LIMITS). */
export const ZOOM_RANGE = {min: GRAPH_ZOOM_LIMITS.minZoom, max: GRAPH_ZOOM_LIMITS.maxZoom} as const
/** The find field keeps at most this many characters (filters.ts restoreGraphFilters). */
export const TEXT_LIMIT = 1024

/** Toggle one member of a set filter, as the panel's checkboxes do: a member that stands is removed, an absent one added. */
export function toggleMember(surface: KnowledgeGraphSurface, key: 'kinds' | 'relations' | 'families' | 'tags', value: string): void {
  const current = surface.filters[key];
  surface.patchFilters({[key]: current.includes(value) ? current.filter(item => item !== value) : [...current, value]});
}

/** Set the filter fields the patch names, as the panel's own controls do (changeFilters). */
export function setFilters(surface: KnowledgeGraphSurface, patch: Parameters<KnowledgeGraphSurface['patchFilters']>[0]): void {
  surface.patchFilters(patch);
}

/** The zoom the zoom buttons set (the camera's zoom, the same setCamera). */
export function setZoom(surface: KnowledgeGraphSurface, zoom: number): void {
  surface.setZoom(zoom);
}

/** The Fit button's own act. */
export function fitView(surface: KnowledgeGraphSurface): void {
  surface.fit();
}
