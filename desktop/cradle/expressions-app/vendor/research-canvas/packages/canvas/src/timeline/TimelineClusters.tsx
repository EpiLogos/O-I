import type { CSSProperties, JSX } from "react";
import type { BroadCluster } from "./clusters";

/** One cluster mark, positioned by the lens on the same camera as the cards. */
export interface TimelineClusterMark {
  cluster: BroadCluster;
  /** "N events, <span label>": a count, labelled as one. */
  label: string;
  startPx: number;
  endPx: number;
  /** Label row, from clusterRows. */
  row: number;
  /** The members' category colour; the stylesheet mixes it toward a neutral. */
  tone: string;
}

/** The first row sits on the below-axis lane; rows step down by this much. */
const CLUSTER_TOP_PX = 68;
const CLUSTER_ROW_PX = 22;

/**
 * Cluster marks at the broad tier (lane-2 T12). A mark is a quiet span bar with
 * its count and span label. Activating it zooms once to the span, through the
 * lens's store. It is never a timeline node and carries no node test id.
 */
export function TimelineClusters({
  marks,
  onZoom,
}: {
  marks: readonly TimelineClusterMark[];
  onZoom: (cluster: BroadCluster) => void;
}): JSX.Element | null {
  if (marks.length === 0) return null;
  return (
    <div
      className="timeline-clusters"
      data-testid="timeline-clusters"
      style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}
    >
      {marks.map((mark, index) => (
        <button
          key={`${mark.cluster.fromMs}:${mark.cluster.count}:${index}`}
          type="button"
          className="timeline-cluster"
          data-testid={`timeline-cluster-${index}`}
          data-count={mark.cluster.count}
          data-row={mark.row}
          aria-label={`${mark.label}. Zoom to this span.`}
          title={`${mark.label}. Zoom to this span.`}
          onClick={(event) => {
            event.stopPropagation();
            onZoom(mark.cluster);
          }}
          style={{
            left: `${mark.startPx}px`,
            top: `${CLUSTER_TOP_PX + mark.row * CLUSTER_ROW_PX}px`,
            width: `${Math.max(4, mark.endPx - mark.startPx)}px`,
            "--cluster-tone": mark.tone,
          } as CSSProperties}
        >
          <span className="timeline-cluster-span" aria-hidden="true" />
          <span className="timeline-cluster-label">{mark.label}</span>
        </button>
      ))}
    </div>
  );
}
