import type { CSSProperties, JSX } from "react";

/** One collapsed parent on the lens camera: its span in pixels and its label, with the child count. */
export interface NestMark {
  parent: string;
  /** "<parent title> · N items": the count is the loaded children's count. */
  label: string;
  leftPx: number;
  widthPx: number;
  /** The span has no disclosed end: it runs to the view's right edge with an open marker. */
  openEnd: boolean;
}

/** The axis header sits above the lanes; a collapsed span starts beneath it. */
const NEST_TOP_PX = 48;

/**
 * Collapsed parents as quiet band-like spans, drawn beneath the scene so every
 * card sits above them (lane-2 T9). Static: no transition or animation. The
 * fill is mixed in the stylesheet (researchInstrumentStyles.css, lane-2 T9-T14).
 */
export function TimelineNestSpans({ marks }: { marks: readonly NestMark[] }): JSX.Element | null {
  if (marks.length === 0) return null;
  return (
    <div
      className="timeline-nest-spans"
      data-testid="timeline-nest-spans"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {marks.map((mark) => (
        <div
          key={mark.parent}
          className="timeline-nest-span"
          data-testid={`timeline-nest-span-${mark.parent}`}
          data-open-end={mark.openEnd ? "true" : "false"}
          style={{
            position: "absolute",
            top: `${NEST_TOP_PX}px`,
            bottom: "0px",
            left: `${mark.leftPx}px`,
            width: `${mark.widthPx}px`,
          } as CSSProperties}
        >
          <span className="timeline-nest-span-label">{mark.label}</span>
        </div>
      ))}
    </div>
  );
}
