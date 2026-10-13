import type { CSSProperties, JSX } from "react";
import type { ParticipantMark } from "./participantSpans";

/** The strip under the axis where participant hairlines stack. */
const PARTICIPANT_TOP_PX = 52;
const PARTICIPANT_ROW_PX = 5;

/**
 * Participant validity as hairline spans, drawn beneath the cards (DOM order
 * before the nodes), so the event cards read against the span of what lived
 * them (lane-2 T14). Static: no transition or animation. The label is written
 * once per participant. An open side fades out at the view edge rather than
 * ending at an invented date.
 */
export function TimelineParticipantSpans({ marks }: { marks: readonly ParticipantMark[] }): JSX.Element | null {
  if (marks.length === 0) return null;
  return (
    <div
      className="timeline-participants"
      data-testid="timeline-participants"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {marks.map((mark) => (
        <div
          key={mark.id}
          className="timeline-participant"
          data-testid={`timeline-participant-${mark.id}`}
          data-kind={mark.participant_kind}
          data-open-start={mark.openStart ? "true" : "false"}
          data-open-end={mark.openEnd ? "true" : "false"}
          title={mark.title}
          style={{
            position: "absolute",
            top: `${PARTICIPANT_TOP_PX + mark.row * PARTICIPANT_ROW_PX}px`,
            left: `${mark.leftPx}px`,
            width: `${mark.widthPx}px`,
          } as CSSProperties}
        >
          <span className="timeline-participant-line" aria-hidden="true" />
          {mark.label !== null && <span className="timeline-participant-label">{mark.label}</span>}
        </div>
      ))}
    </div>
  );
}
