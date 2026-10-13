import type { JSX } from "react";
import type { AxisTick } from "./ticks";

export interface TimelineAxisProps {
  ticks: AxisTick[];
  height: number;
}

export function TimelineAxis({ ticks, height }: TimelineAxisProps): JSX.Element {
  return (
    <div
      className="timeline-axis"
      data-testid="timeline-axis"
      style={{ height: `${height}px` }}
    >
      {ticks.map((tick) => (
        <div
          key={tick.ms}
          data-testid={`axis-tick-${tick.ms}`}
          data-unit={tick.unit}
          className="timeline-axis-tick"
          style={{ position: "absolute", left: `${tick.px}px`, top: "0px" }}
        >
          <span className="timeline-axis-tick-line" />
          <span className="timeline-axis-tick-label">{tick.label}</span>
        </div>
      ))}
    </div>
  );
}
