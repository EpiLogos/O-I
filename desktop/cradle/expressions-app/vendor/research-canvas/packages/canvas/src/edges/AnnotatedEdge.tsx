import { useEffect, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useEdges,
  type Edge,
  type EdgeProps,
  type Position
} from "@xyflow/react";

import { RELATIONSHIP_KINDS } from "../content/relationshipKinds";

type AnnotatedEdgeData = Record<string, unknown> & {
  directionality?: "none" | "forward" | "backward" | "bidirectional";
  note?: string;
  onSelect?: () => void;
  onCycleDirectionality?: () => void;
  onDelete?: () => void;
  onUpdateRelationKind?: (relationKind: string) => void;
  relationKind: string;
  selected?: boolean;
  sequencing?: boolean;
};

export function AnnotatedEdge({
  id,
  source,
  target,
  data,
  markerStart,
  markerEnd,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition
}: EdgeProps<Edge<AnnotatedEdgeData, "annotated">>) {
  const [draftRelationKind, setDraftRelationKind] = useState(data?.relationKind ?? "");
  const cancelEditRef = useRef(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setDraftRelationKind(data?.relationKind ?? "");
  }, [data?.relationKind]);

  useEffect(() => {
    if (data?.selected) {
      selectRef.current?.focus();
    }
  }, [data?.selected]);

  // Distinct native relation occurrences with the same endpoints/type are
  // never accidentally deduplicated away, and never made unselectable by a
  // sibling edge stealing the whole shared path. Every edge on the same
  // unordered node pair gets its own curvature offset, computed here from
  // the live edge list so no host wiring is required. A pair with only one
  // edge keeps the exact prior single-edge path and label placement.
  const allEdges = useEdges<Edge<AnnotatedEdgeData, "annotated">>();
  const pairKey = source && target ? [source, target].slice().sort().join("\u0000") : null;
  const parallelSiblings = pairKey
    ? allEdges
        .filter((candidate) => candidate.source && candidate.target && [candidate.source, candidate.target].slice().sort().join("\u0000") === pairKey)
        .map((candidate) => candidate.id)
        .sort()
    : [id];
  const parallelCount = parallelSiblings.length;
  const parallelIndex = Math.max(0, parallelSiblings.indexOf(id));

  let edgePath: string, labelX: number, labelY: number;
  if (parallelCount > 1) {
    // The perpendicular is taken from a canonical (alphabetically ordered)
    // direction, not from this edge's own source/target: two edges drawn in
    // opposite directions between the same pair would otherwise cancel each
    // other's offset back onto the same path.
    const canonicalForward = !target || (source ?? "") <= target;
    const dx = canonicalForward ? targetX - sourceX : sourceX - targetX;
    const dy = canonicalForward ? targetY - sourceY : sourceY - targetY;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    const spacing = 28;
    const offset = (parallelIndex - (parallelCount - 1) / 2) * spacing;
    const controlX = midX + nx * offset;
    const controlY = midY + ny * offset;
    edgePath = `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;
    labelX = 0.25 * sourceX + 0.5 * controlX + 0.25 * targetX;
    labelY = 0.25 * sourceY + 0.5 * controlY + 0.25 * targetY;
  } else {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition: sourcePosition as Position,
      targetX,
      targetY,
      targetPosition: targetPosition as Position
    });
  }

  return (
    <>
      <g data-sequencing={data?.sequencing ? "true" : "false"} data-testid={`edge-${id}`}>
        <BaseEdge markerStart={markerStart} markerEnd={markerEnd} path={edgePath} />
      </g>
      <EdgeLabelRenderer>
        <div
          className="flow-edge-label"
          data-selected={data?.selected ? "true" : "false"}
          data-sequencing={data?.sequencing ? "true" : "false"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data?.onSelect?.();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
          }}
        >
          <div className="flow-edge-label__text">
            {data?.selected && !data.readOnly && data.onUpdateRelationKind ? (
              <select
                aria-label="Relation kind"
                className="flow-edge-label__select"
                onBlur={() => {
                  if (cancelEditRef.current) {
                    cancelEditRef.current = false;
                    setDraftRelationKind(data?.relationKind ?? "");
                    return;
                  }
                  if (draftRelationKind && draftRelationKind !== data?.relationKind) {
                    data?.onUpdateRelationKind?.(draftRelationKind);
                  }
                }}
                onChange={(event) => {
                  const nextRelationKind = event.currentTarget.value;
                  setDraftRelationKind(nextRelationKind);
                  if (nextRelationKind) {
                    data?.onUpdateRelationKind?.(nextRelationKind);
                  }
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEditRef.current = true;
                    setDraftRelationKind(data?.relationKind ?? "");
                    selectRef.current?.blur();
                  }
                }}
                ref={selectRef}
                value={draftRelationKind}
              >
                {RELATIONSHIP_KINDS.map((option) => (
                  <option key={option.kind} value={option.kind}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{data?.relationKind}</strong>
            )}
            {data?.note ? <span>{data.note}</span> : null}
          </div>
          {data?.selected && !data.readOnly ? (
            <div className="flow-edge-actions">
              {data.onCycleDirectionality && <button
                className="flow-edge-action"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  data.onCycleDirectionality?.();
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                title={`Cycle arrow direction (${data.directionality ?? "forward"})`}
                type="button"
              >
                ⇄
              </button>}
              {data.onDelete && <button
                className="flow-edge-action"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  data.onDelete?.();
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                title="Delete edge"
                type="button"
              >
                ×
              </button>}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
