import type {
  GraphNode,
  GraphRelationship,
  TimelineViewNode,
} from "./contracts";
import { anchorExtent } from "./instant";
import { bandExtent, type TimelineItem } from "./projection";

/**
 * Nestable timeline framing (vision §3.5, ticket #3): the main timeline's
 * spatial zero-case is Earth; any temporal node can frame a sub-timeline.
 * Membership of a frame is agent-derived in v1 — the frame node plus nodes
 * directly related to it — and human curation layers on top in the curation
 * surface.
 */
export type TimelineSpatialFrame = "earth" | "place" | "none";

export interface TimelineFrameState {
  frameNodeId: string;
  title: string;
  /** A Place frame is a spatial sub-timeline; other temporal frames are
   * time-bounded without a spatial claim. Earth is the zero-case. */
  spatialFrame: TimelineSpatialFrame;
  /** The frame's own temporal window in epoch ms (its honest validFrom–validTo extent). */
  window: { fromMs: number; toMs: number } | null;
}

/** A trans-temporal node hovering above a sub-timeline. Archetypes, Dynamics,
 * and pure Works are never nested inside a frame — they light it from above. */
export interface TimelineHoverNode {
  graphNodeId: string;
  node: GraphNode;
}

export const TRANS_TEMPORAL_HOVER_ENTITY_TYPES = new Set([
  "Archetype",
  "Dynamic",
  "Work",
]);

export function relatedNodeIds(
  frameNodeId: string,
  relationships: GraphRelationship[],
): Set<string> {
  const ids = new Set<string>([frameNodeId]);
  for (const relationship of relationships) {
    if (relationship.sourceGraphNodeId === frameNodeId) {
      ids.add(relationship.targetGraphNodeId);
    }
    if (relationship.targetGraphNodeId === frameNodeId) {
      ids.add(relationship.sourceGraphNodeId);
    }
  }
  return ids;
}

/** Resolves a node's own temporal extent as the frame window. Non-temporal
 * nodes cannot frame a sub-timeline. */
export function frameStateForNode(
  nodes: TimelineViewNode[],
  frameNodeId: string,
): TimelineFrameState | null {
  const record = nodes.find(({ node }) => node.graphNodeId === frameNodeId);
  if (!record || !record.node.isTemporal) {
    return null;
  }
  const extent = anchorExtent(record.anchor.validFrom, record.anchor.validTo, record.anchor.precision);
  if (extent === null) {
    return null;
  }
  return {
    frameNodeId,
    title: record.node.title,
    spatialFrame: record.node.entityType === "Place" ? "place" : "none",
    window: { fromMs: extent.fromMs, toMs: extent.toMs ?? extent.fromMs },
  };
}

/** Sub-timeline membership: the frame node plus its directly related nodes,
 * clamped to the frame's temporal window. */
export function projectSubTimeline(
  items: TimelineItem[],
  relationships: GraphRelationship[],
  frame: TimelineFrameState,
): TimelineItem[] {
  const related = relatedNodeIds(frame.frameNodeId, relationships);
  let members = items.filter((item) => related.has(item.graphNodeId));
  if (frame.window) {
    const { fromMs, toMs } = frame.window;
    members = members.filter((item) => {
      const itemEnd = bandExtent(item).toMs;
      // Overlap semantics: a place whose identity spans the whole frame
      // window still belongs to the frame's sub-timeline.
      return itemEnd >= fromMs && item.startMs <= toMs;
    });
  }
  return members;
}

/** Trans-temporal nodes related to the frame; they hover, never nest. */
export function transTemporalHover(
  nodes: TimelineViewNode[],
  relationships: GraphRelationship[],
  frameNodeId: string,
): TimelineHoverNode[] {
  const related = relatedNodeIds(frameNodeId, relationships);
  return nodes
    .filter(
      ({ node }) =>
        !node.isTemporal &&
        TRANS_TEMPORAL_HOVER_ENTITY_TYPES.has(node.entityType) &&
        related.has(node.graphNodeId),
    )
    .map(({ node }) => ({ graphNodeId: node.graphNodeId, node }));
}
