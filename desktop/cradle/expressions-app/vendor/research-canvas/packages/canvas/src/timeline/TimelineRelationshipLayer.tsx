import type { JSX } from "react";

import type { GraphRelationship } from "./contracts";
import type { PlacedItem } from "./projection";
import type { TimelineNodeLod } from "./TimelineNode";
import { STANDING_DRAWING, standingLabel, standingOfRelationshipProperties } from "./standingStyle";
import { STANDING_LEGEND, type StandingVisual } from "../../../../../../../src/techne/m0m5/timeline/standing";
import { projectionForRelation } from "../../../../../../../src/techne/m0m5/timeline/relations";
import { NO_DATE_DISCLOSED, hopLabel, type CauseChain, type CauseHop } from "./causeChain";

const VIEWBOX_HEIGHT = 480;
/** The curve's resting opacity, and the opacities of a followed chain on a dimmed field. */
const EDGE_OPACITY = "0.55";
const CHAIN_EDGE_OPACITY = "0.95";
const DIMMED_EDGE_OPACITY = "0.12";

/**
 * The standing an edge is drawn with (lane-2 T11): the authority's `standingOf`
 * over the edge's own properties, as the bridge writes them. `disclosed` is true
 * only when the owner names a standing string; an undisclosed edge keeps the
 * relation-type drawing (lead ruling, T3).
 */
export function relationshipStanding(properties: Record<string, unknown>): {
  visual: StandingVisual;
  verbatim: string | null;
  disclosed: boolean;
} {
  const standing = standingOfRelationshipProperties(properties);
  return { visual: standing.visual, verbatim: standing.verbatim, disclosed: standing.verbatim !== null };
}

export function TimelineRelationshipLayer({
  relationships = [],
  placed,
  viewportWidth,
  lod,
  chain = null,
  onSelectChain,
}: {
  relationships: GraphRelationship[];
  placed: PlacedItem[];
  viewportWidth: number;
  lod: TimelineNodeLod;
  /** The followed cause chain (lane-2 T10), or none. Its hops draw in sequence on a dimmed field. */
  chain?: CauseChain | null;
  /** Selecting a cause-family edge (click or Enter) asks the surface to follow its chain. */
  onSelectChain?: (relationshipId: string) => void;
}): JSX.Element | null {
  if (lod === "marker" || relationships.length === 0 || viewportWidth <= 0) return null;

  const placementByNodeId = new Map(placed.map((item) => [item.item.graphNodeId, item]));
  const visible = relationships.flatMap((relationship) => {
    const source = placementByNodeId.get(relationship.sourceGraphNodeId);
    const target = placementByNodeId.get(relationship.targetGraphNodeId);
    return source && target ? [{ relationship, source, target }] : [];
  });
  if (visible.length === 0) return null;

  const hopIndex = new Map((chain?.hops ?? []).map((hop, index) => [hop.id, index]));

  return (
    <>
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
          // The relation-type palette is the established drawing and stays (T3 ruling). T11 adds
          // the edge's standing on top: its dash, its arrowhead colour and a class. The verbatim
          // standing rides in the title. An undisclosed edge draws exactly as before.
          const style = relationshipStyle(relationship.relType);
          const standing = relationshipStanding(relationship.properties);
          const drawing = standing.disclosed ? STANDING_DRAWING[standing.visual] : null;
          const dash = drawing ? drawing.dash : style.dashed ? "5 5" : undefined;
          const hop = hopIndex.get(relationship.id);
          const inChain = hop !== undefined;
          const opacity = chain === null ? EDGE_OPACITY : inChain ? CHAIN_EDGE_OPACITY : DIMMED_EDGE_OPACITY;
          const x1 = source.startPx;
          const x2 = target.startPx;
          const span = Math.max(Math.abs(x2 - x1), 36);
          const bend = Math.min(116, 26 + span * 0.12);
          const apexY = VIEWBOX_HEIGHT / 2 - bend * 0.75;
          const midX = (x1 + x2) / 2;
          const path = `M ${x1} ${VIEWBOX_HEIGHT / 2} C ${x1} ${VIEWBOX_HEIGHT / 2 - bend}, ${x2} ${VIEWBOX_HEIGHT / 2 - bend}, ${x2} ${VIEWBOX_HEIGHT / 2}`;
          const selectable = onSelectChain !== undefined && projectionForRelation(relationship.relType) === "cause";
          return (
            <g
              key={relationship.id}
              data-testid={`timeline-relationship-${relationship.id}`}
              data-relation-kind={relationship.relType}
              data-standing={standing.disclosed ? standing.visual : undefined}
              data-chain-hop={inChain ? hop + 1 : undefined}
            >
              {standing.disclosed && (
                <title>{`${standingLabel(standing.visual)} · "${standing.verbatim}"`}</title>
              )}
              <path
                d={path}
                className={standing.disclosed ? `timeline-relationship timeline-relationship--${standing.visual}` : undefined}
                fill="none"
                stroke={style.stroke}
                strokeDasharray={dash}
                strokeWidth={inChain ? "2" : "1"}
                opacity={opacity}
                vectorEffect="non-scaling-stroke"
              />
              {/* Direction: the arrowhead sits where the curve enters its target, pointing into the axis. */}
              <path
                className="timeline-relationship-arrow"
                d={`M ${x2} ${VIEWBOX_HEIGHT / 2} L ${x2 - 4} ${VIEWBOX_HEIGHT / 2 - 8} L ${x2 + 4} ${VIEWBOX_HEIGHT / 2 - 8} Z`}
                fill={drawing ? drawing.stroke : style.stroke}
                opacity={opacity}
              />
              {inChain && (
                <text className="timeline-chain-index" x={midX} y={apexY} textAnchor="middle">{hop + 1}</text>
              )}
              {selectable && (
                <path
                  className="timeline-relationship-hit"
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  pointerEvents="stroke"
                  role="button"
                  tabIndex={0}
                  aria-label={`Follow the cause chain through ${relationship.relType}`}
                  onClick={() => onSelectChain?.(relationship.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectChain?.(relationship.id);
                    }
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>
      <StandingLegend />
    </>
  );
}

/**
 * The standing legend (lane-2 T11): the authority's `STANDING_LEGEND`, drawn with the
 * shared table's dash and colour. The relation field's standing chips read the same
 * entries, so both projections name a standing one way.
 */
export function StandingLegend(): JSX.Element {
  return (
    <ul className="timeline-standing-legend" aria-label="Relation standing" data-testid="timeline-standing-legend">
      {STANDING_LEGEND.map((entry) => {
        const drawing = STANDING_DRAWING[entry.visual];
        return (
          <li key={entry.visual} className={`timeline-standing-legend-item timeline-standing-legend-item--${entry.visual}`} title={entry.description}>
            <svg width="30" height="8" viewBox="0 0 30 8" aria-hidden="true" focusable="false">
              <path d="M 1 4 L 23 4" fill="none" stroke={drawing.stroke} strokeDasharray={drawing.dash} strokeWidth="1.5" />
              <path d="M 22 1 L 28 4 L 22 7 Z" fill={drawing.stroke} />
            </svg>
            <span>{entry.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The followed chain (lane-2 T10): its hops in sequence, each with its endpoints,
 * its relation verbatim, its standing, its time (or "no date disclosed") and its
 * offset from the hop before. Follow moves the camera once, through `onFollow`.
 */
export function CauseChainPanel({
  chain,
  titleOf,
  onFollow,
  onClear,
}: {
  chain: CauseChain;
  titleOf: (graphNodeId: string) => string;
  onFollow: (hop: CauseHop) => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <section className="timeline-chain-panel" aria-label="Cause chain" data-testid="timeline-cause-chain">
      <header className="timeline-chain-head">
        <h3>Cause chain · {chain.hops.length} hop{chain.hops.length === 1 ? "" : "s"}</h3>
        <button type="button" onClick={onClear}>Clear chain</button>
      </header>
      <ol className="timeline-chain-hops">
        {chain.hops.map((hop, index) => {
          const standingText = `${standingLabel(hop.standing.visual)}${hop.standing.verbatim !== null ? ` · "${hop.standing.verbatim}"` : ""}`;
          return (
            <li key={hop.id} className="timeline-chain-hop" data-testid={`timeline-chain-hop-${index + 1}`} data-standing={hop.standing.visual}>
              <span className="timeline-chain-hop-index">{index + 1}</span>
              <span className="timeline-chain-hop-path">
                {titleOf(hop.from_ref)}
                <span className="timeline-chain-hop-relation" title={standingText}>{` —${hop.relation}→ `}</span>
                {titleOf(hop.to_ref)}
              </span>
              <span className="timeline-chain-hop-time" data-undated={hop.time === null ? "true" : undefined} title={hop.time === null ? hop.timeNote ?? NO_DATE_DISCLOSED : undefined}>
                {hopLabel(hop)}
              </span>
              <span className="timeline-chain-hop-offset">
                {hop.offset === null ? "start of chain" : hop.offset.label}
              </span>
              <button
                type="button"
                disabled={hop.time === null}
                title={hop.time === null ? (hop.timeNote ?? NO_DATE_DISCLOSED) : "Move the camera to this hop"}
                onClick={() => onFollow(hop)}
              >
                Follow
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function relationshipStyle(relationKind: string) {
  if (["CONTESTS", "OPPOSES"].includes(relationKind)) return { stroke: "#e07a6f", dashed: true };
  if (["CAUSES", "PRECEDES", "INFLUENCES", "SUPPORTS"].includes(relationKind)) return { stroke: "#79c0d4", dashed: false };
  if (["SOURCED_FROM", "QUALIFIES"].includes(relationKind)) return { stroke: "#5fb8a0", dashed: true };
  return { stroke: "#b9a784", dashed: true };
}
