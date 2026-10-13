import type { CSSProperties, JSX } from "react";
import type { BandMark } from "./bands";

/**
 * The period bands as quiet full-height lanes, drawn beneath the scene so every
 * card sits above them. Static: no transition or animation. The tone is the
 * standing class's colour carried as the token --band-tone; the fill is mixed
 * in the stylesheet (timeline.css, lane-2 T8).
 */
export function TimelineBandLanes({ marks }: { marks: readonly BandMark[] }): JSX.Element | null {
  if (marks.length === 0) return null;
  return (
    <div
      className="timeline-band-lanes"
      data-testid="timeline-band-lanes"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {marks.map((mark) => (
        <div
          key={mark.id}
          className="timeline-band-lane"
          data-testid={`timeline-band-lane-${mark.id}`}
          data-standing={mark.visual}
          style={{
            position: "absolute",
            left: `${mark.leftPx}px`,
            width: `${mark.widthPx}px`,
            "--band-tone": mark.tone,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
