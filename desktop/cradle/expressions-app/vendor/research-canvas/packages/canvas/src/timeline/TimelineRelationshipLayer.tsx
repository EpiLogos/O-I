import type { JSX } from "react";

import type { GraphRelationship } from "./contracts";
import type { PlacedItem } from "./projection";
import type { TimelineNodeLod } from "./TimelineNode";
import { STANDING_DRAWING, standingLabel, standingOfRelationshipProperties } from "./standingStyle";

const VIEWBOX_HEIGHT = 480;

export function TimelineRelationshipLayer({
  relationships = [],
  placed,
  viewportWidth,
  lod,
}: {
  relationships: GraphRelationship[];
  placed: PlacedItem[];
  viewportWidth: number;
  lod: TimelineNodeLod;
}): JSX.Element | null {
  if (lod === "marker" || relationships.length === 0 || viewportWidth <= 0) return null;

  const placementByNodeId = new Map(placed.map((item) => [item.item.graphNodeId, item]));
  const visible = relationships.flatMap((relationship) => {
    const source = placementByNodeId.get(relationship.sourceGraphNodeId);
    const target = placementByNodeId.get(relationship.targetGraphNodeId);
    return source && target ? [{ relationship, source, target }] : [];
  });
  if (visible.length === 0) return null;

  return (
    <svg
      aria-label="Timeline relationships"
      className="timeline-relationship-layer"
      data-testid="timeline-relationship-layer"
      width={viewportWidth}
      height="100%"
      viewBox={`0 0 ${viewportWidth} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
    >
      {visible.map(({ relationship, source, target }) => {
        // The relation-type palette is the established drawing and stays. T3 adds the
        // standing on top, only when the relation discloses a standing string: then its
        // dash (and a title naming the label and the verbatim string) comes from the shared
        // standing table. An edge with no disclosed standing draws exactly as before.
        const style = relationshipStyle(relationship.relType);
        const standing = standingOfRelationshipProperties(relationship.properties);
        const disclosed = standing.verbatim !== null;
        const dash = disclosed ? STANDING_DRAWING[standing.visual].dash : style.dashed ? "5 5" : undefined;
        const x1 = source.startPx;
        const x2 = target.startPx;
        const span = Math.max(Math.abs(x2 - x1), 36);
        const bend = Math.min(116, 26 + span * 0.12);
        return (
          <g
            key={relationship.id}
            data-testid={`timeline-relationship-${relationship.id}`}
            data-relation-kind={relationship.relType}
            data-standing={disclosed ? standing.visual : undefined}
          >
            {disclosed && (
              <title>{`${standingLabel(standing.visual)} · "${standing.verbatim}"`}</title>
            )}
            <path
              d={`M ${x1} ${VIEWBOX_HEIGHT / 2} C ${x1} ${VIEWBOX_HEIGHT / 2 - bend}, ${x2} ${VIEWBOX_HEIGHT / 2 - bend}, ${x2} ${VIEWBOX_HEIGHT / 2}`}
              className={disclosed ? `timeline-relationship timeline-relationship--${standing.visual}` : undefined}
              fill="none"
              stroke={style.stroke}
              strokeDasharray={dash}
              strokeWidth="1"
              opacity="0.55"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

function relationshipStyle(relationKind: string) {
  if (["CONTESTS", "OPPOSES"].includes(relationKind)) return { stroke: "#e07a6f", dashed: true };
  if (["CAUSES", "PRECEDES", "INFLUENCES", "SUPPORTS"].includes(relationKind)) return { stroke: "#79c0d4", dashed: false };
  if (["SOURCED_FROM", "QUALIFIES"].includes(relationKind)) return { stroke: "#5fb8a0", dashed: true };
  return { stroke: "#b9a784", dashed: true };
}
