import { useReactFlow, useViewport } from "@xyflow/react";
import { useRef, useState, type PointerEvent } from "react";

import type { Annotation, AnnotationPoint } from "@research-canvas/schema";

import { strokePathFromPoints } from "./annotationTools";

interface AnnotationLayerProps {
  annotations: Annotation[];
  drawingEnabled: boolean;
  onCreateStroke: (points: AnnotationPoint[]) => void;
  /** Colour of the in-progress stroke; matches the host's stroke tool. */
  draftColour?: string;
  /** Erase mode: tapping a stroke removes it through onDeleteStroke. */
  erasing?: boolean;
  onDeleteStroke?: (annotationId: string) => void;
}

export function AnnotationLayer({
  annotations,
  drawingEnabled,
  onCreateStroke,
  draftColour,
  erasing = false,
  onDeleteStroke
}: AnnotationLayerProps) {
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useViewport();
  const [draftPoints, setDraftPoints] = useState<AnnotationPoint[]>([]);
  const draftPointsRef = useRef<AnnotationPoint[]>([]);
  const drawingRef = useRef(false);

  const beginStroke = (event: PointerEvent<SVGSVGElement>) => {
    if (!drawingEnabled || erasing) {
      return;
    }

    const point = pointFromEvent(event, screenToFlowPosition);
    drawingRef.current = true;
    draftPointsRef.current = [point];
    setDraftPoints([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const eraseStroke = (annotationId: string) => (event: PointerEvent<SVGPathElement>) => {
    if (!erasing) {
      return;
    }
    event.stopPropagation();
    onDeleteStroke?.(annotationId);
  };

  const extendStroke = (event: PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) {
      return;
    }

    const nextPoints = [
      ...draftPointsRef.current,
      pointFromEvent(event, screenToFlowPosition),
    ];
    draftPointsRef.current = nextPoints;
    setDraftPoints(nextPoints);
  };

  const endStroke = () => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;

    if (draftPointsRef.current.length > 1) {
      onCreateStroke(draftPointsRef.current);
    }

    draftPointsRef.current = [];
    setDraftPoints([]);
  };

  return (
    <svg
      className="annotation-layer"
      data-drawing={drawingEnabled || erasing}
      data-erasing={erasing}
      data-testid="annotation-surface"
      onPointerDown={beginStroke}
      onPointerLeave={endStroke}
      onPointerMove={extendStroke}
      onPointerUp={endStroke}
    >
      <g
        transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}
      >
        {annotations.map((annotation) => (
          <path
            d={strokePathFromPoints(annotation.points, annotation.style.width)}
            fill={annotation.style.color}
            fillOpacity={annotation.style.opacity}
            key={annotation.id}
            onPointerDown={eraseStroke(annotation.id)}
          />
        ))}

        {draftPoints.length > 1 ? (
          <path
            d={strokePathFromPoints(draftPoints, 4)}
            fill={draftColour ?? "#f0b45a"}
            fillOpacity={0.9}
          />
        ) : null}
      </g>
    </svg>
  );
}

function pointFromEvent(
  event: PointerEvent<SVGSVGElement>,
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number },
): AnnotationPoint {
  const position = screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  });
  return {
    x: position.x,
    y: position.y,
    pressure: event.pressure > 0 ? event.pressure : 0.5
  };
}
