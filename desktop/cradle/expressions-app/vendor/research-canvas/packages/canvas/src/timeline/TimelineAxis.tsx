import type { CSSProperties, JSX } from "react";
import type { AxisTick } from "./ticks";

export interface TimelineAxisProps {
  /** The coarser row, labelled with its context ("Mar 1850", "1850"). */
  major: AxisTick[];
  /** The finer row, short labels at the authority's unit ("Mar", "4", "10:00"). */
  minor: AxisTick[];
  height: number;
}

/**
 * Two fixed rows. The major row spans the whole axis height; the minor row sits
 * beneath it. Positions are absolute and keyed by the mark's own ms, and figures
 * are tabular, so a label never reflows or animates between frames.
 */
const MAJOR_LABEL_COLOUR = "#aab4c6";
const MINOR_ROW_TOP_PX = 22;
const MINOR_ROW_LINE_PX = 10;
const TABULAR: CSSProperties = { fontVariantNumeric: "tabular-nums" };

export function TimelineAxis({ major, minor, height }: TimelineAxisProps): JSX.Element {
  return (
    <div
      className="timeline-axis"
      data-testid="timeline-axis"
      style={{ height: `${height}px` }}
    >
      {major.map((tick) => (
        <div
          key={`major-${tick.ms}`}
          data-testid={`axis-major-${tick.ms}`}
          data-unit={tick.unit}
          className="timeline-axis-tick timeline-axis-tick--major"
          style={{ position: "absolute", left: `${tick.px}px`, top: "0px", height: `${height}px`, display: "block", width: "0px" }}
        >
          <span
            className="timeline-axis-tick-line"
            style={{ position: "absolute", left: "0px", top: "0px", width: "1px", height: `${height}px`, background: "#344256" }}
          />
          <span
            className="timeline-axis-tick-label"
            style={{ position: "absolute", left: "0px", top: "2px", fontSize: "11px", color: MAJOR_LABEL_COLOUR, ...TABULAR }}
          >
            {tick.label}
          </span>
        </div>
      ))}
      {minor.map((tick) => (
        <div
          key={`minor-${tick.ms}`}
          data-testid={`axis-minor-${tick.ms}`}
          data-unit={tick.unit}
          className="timeline-axis-tick timeline-axis-tick--minor"
          style={{ position: "absolute", left: `${tick.px}px`, top: "0px", height: `${height}px`, display: "block", width: "0px" }}
        >
          <span
            className="timeline-axis-tick-line"
            style={{ position: "absolute", left: "0px", top: `${MINOR_ROW_TOP_PX}px`, width: "1px", height: `${MINOR_ROW_LINE_PX}px`, background: "#344256" }}
          />
          <span
            className="timeline-axis-tick-label"
            style={{ position: "absolute", left: "0px", top: `${MINOR_ROW_TOP_PX}px`, ...TABULAR }}
          >
            {tick.label}
          </span>
        </div>
      ))}
    </div>
  );
}
