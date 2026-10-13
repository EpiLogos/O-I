import { useRef, type JSX, type PointerEvent as ReactPointerEvent } from "react";
import {
  minimapCoversDomain,
  minimapExtent,
  minimapPanCentre,
  minimapYearAt,
  minimapZoom,
  type YearSpan,
} from "./minimapGeometry";

/** The grab zone on each edge of the window, in px. */
const EDGE_GRAB_PX = 6;
/** The smallest half-width a drag may zoom to, in px. */
const MIN_HALF_PX = 2;

interface MinimapDrag {
  mode: "pan" | "edge-left" | "edge-right";
  startX: number;
  startCentre: number;
  startPixelsPerYear: number;
  startHalfPx: number;
  midPx: number;
  widthPx: number;
}

export interface TimelineMinimapProps {
  /** The reading domain: the native timeExtent. */
  domain: YearSpan;
  /** The span the person sees (visibleSpanForViewport): the highlight. */
  visible: YearSpan;
  centerYear: number;
  pixelsPerYear: number;
  onPan: (centerYear: number) => void;
  onZoom: (pixelsPerYear: number) => void;
}

/**
 * The scale-window strip (lane-2 T13): the whole reading domain, with the
 * visible span (what the person sees) highlighted. Dragging the window pans, so the centre follows
 * the pointer. Dragging an edge zooms proportionally about the centre. A press
 * outside the window moves the centre to that point. Arrow keys stay with the
 * lens. Hidden when the window already holds the whole domain. Static: no
 * transition, no animation.
 */
export function TimelineMinimap({
  domain,
  visible,
  centerYear,
  pixelsPerYear,
  onPan,
  onZoom,
}: TimelineMinimapProps): JSX.Element | null {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<MinimapDrag | null>(null);
  if (minimapCoversDomain(visible, domain)) return null;
  const { leftFraction, rightFraction } = minimapExtent(visible, domain);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const strip = stripRef.current;
    if (!strip || event.button !== 0) return;
    const rect = strip.getBoundingClientRect();
    const widthPx = Math.max(1, rect.width);
    const x = event.clientX - rect.left;
    const leftPx = leftFraction * widthPx;
    const rightPx = rightFraction * widthPx;
    const part = (event.target as HTMLElement).closest<HTMLElement>("[data-part]")?.dataset.part;
    let mode: MinimapDrag["mode"] = "pan";
    let startCentre = centerYear;
    if (part === "edge-left") {
      mode = "edge-left";
    } else if (part === "edge-right") {
      mode = "edge-right";
    } else if (part !== "window") {
      startCentre = minimapYearAt(domain, widthPx, x);
      onPan(startCentre);
    }
    strip.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      startX: x,
      startCentre,
      startPixelsPerYear: pixelsPerYear,
      startHalfPx: (rightPx - leftPx) / 2,
      midPx: (leftPx + rightPx) / 2,
      widthPx,
    };
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const strip = stripRef.current;
    if (!drag || !strip) return;
    const x = event.clientX - strip.getBoundingClientRect().left;
    if (drag.mode === "pan") {
      onPan(minimapPanCentre(drag.startCentre, x - drag.startX, drag.widthPx, domain));
      return;
    }
    const targetHalfPx = Math.max(MIN_HALF_PX, Math.abs(x - drag.midPx));
    onZoom(minimapZoom(drag.startPixelsPerYear, drag.startHalfPx, targetHalfPx));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    const strip = stripRef.current;
    if (strip?.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={stripRef}
      className="timeline-minimap"
      data-testid="timeline-minimap"
      role="group"
      aria-label="Timeline scale window: the camera's place in the whole reading"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="timeline-minimap-window"
        data-testid="timeline-minimap-window"
        data-part="window"
        style={{
          left: `${leftFraction * 100}%`,
          width: `${Math.max(0, rightFraction - leftFraction) * 100}%`,
          minWidth: `${EDGE_GRAB_PX}px`,
        }}
      >
        <span className="timeline-minimap-edge timeline-minimap-edge--left" data-part="edge-left" aria-hidden="true" />
        <span className="timeline-minimap-edge timeline-minimap-edge--right" data-part="edge-right" aria-hidden="true" />
      </div>
    </div>
  );
}
