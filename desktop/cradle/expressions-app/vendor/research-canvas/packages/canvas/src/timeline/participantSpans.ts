/**
 * lane-2 T14 — participant spans behind the event cards (pure geometry).
 *
 * A participant's validity (a person's life, a place's identity span, an
 * institution's operation) is drawn as a hairline on the same ms camera the
 * cards use. The spans come from the authority (`participantSpansFromReading`);
 * this module only places them. A null side is open: the hairline runs to the
 * view edge with an open marker, and no end is invented. The participant's own
 * native ref is its label, written once, at its first visible span. Overlapping
 * spans stack into rows. Pure: no React, no store.
 */
import type { ParticipantSpan } from "../../../../../../../src/techne/m0m5/timeline/relations";
import { spanLabel } from "./labels";
import { msToPixel, pixelToMs, type TimeCamera } from "./viewport";

export interface ParticipantMark {
  /** The participant ref plus the span's index among that participant's spans. */
  id: string;
  participant_ref: string;
  participant_kind: "subject" | "place";
  leftPx: number;
  widthPx: number;
  /** No start is disclosed: the hairline runs from the view's left edge. */
  openStart: boolean;
  /** No end is disclosed: the hairline runs to the view's right edge. */
  openEnd: boolean;
  /** Stacking row: overlapping spans take separate rows. */
  row: number;
  /** The participant's ref, written once: on its first visible span only. */
  label: string | null;
  /** Hover text: the ref, its validity in words, and its uncertainty verbatim. */
  title: string;
}

/** Gap between two spans in one row, so adjacent hairlines do not touch. */
const ROW_GAP_PX = 6;

function titleOf(span: ParticipantSpan): string {
  const when = span.fromMs !== null && span.toMs !== null
    ? spanLabel(span.fromMs, span.toMs, 0)
    : span.fromMs !== null
      ? `from ${spanLabel(span.fromMs, span.fromMs, 0)}, no end disclosed`
      : span.toMs !== null
        ? `until ${spanLabel(span.toMs, span.toMs, 0)}, no start disclosed`
        : "no dates disclosed";
  return [span.participant_ref, when, span.uncertainty, span.source_ref]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" · ");
}

/**
 * The marks for the spans that fall in the view. A span outside the view is
 * culled. Rows are assigned left to right, deterministically.
 */
export function participantMarks(spans: readonly ParticipantSpan[], camera: TimeCamera): ParticipantMark[] {
  const viewFrom = pixelToMs(camera, 0);
  const viewTo = pixelToMs(camera, camera.widthPx);
  const indexOf = new Map<string, number>();
  const visible: { span: ParticipantSpan; id: string; leftPx: number; rightPx: number }[] = [];
  for (const span of spans) {
    const index = indexOf.get(span.participant_ref) ?? 0;
    indexOf.set(span.participant_ref, index + 1);
    if (span.fromMs !== null && span.fromMs > viewTo) continue;
    if (span.toMs !== null && span.toMs < viewFrom) continue;
    const leftPx = span.fromMs === null ? 0 : Math.max(0, msToPixel(camera, span.fromMs));
    const rightPx = span.toMs === null ? camera.widthPx : Math.min(camera.widthPx, msToPixel(camera, span.toMs));
    if (rightPx < leftPx) continue;
    visible.push({ span, id: `${span.participant_ref}#${index}`, leftPx, rightPx });
  }

  // Rows: pack left to right; a span takes the first row whose last span ends before it starts.
  const rowEnds: number[] = [];
  const rowOf = new Map<string, number>();
  for (const entry of [...visible].sort((a, b) => (a.leftPx - b.leftPx) || a.id.localeCompare(b.id))) {
    let row = rowEnds.findIndex((end) => end + ROW_GAP_PX <= entry.leftPx);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(entry.rightPx);
    } else {
      rowEnds[row] = entry.rightPx;
    }
    rowOf.set(entry.id, row);
  }

  // The label goes to each participant's first visible span, in reading order.
  const labelled = new Set<string>();
  return visible.map((entry) => {
    const label = labelled.has(entry.span.participant_ref) ? null : entry.span.participant_ref;
    labelled.add(entry.span.participant_ref);
    return {
      id: entry.id,
      participant_ref: entry.span.participant_ref,
      participant_kind: entry.span.participant_kind,
      leftPx: entry.leftPx,
      widthPx: entry.rightPx - entry.leftPx,
      openStart: entry.span.fromMs === null,
      openEnd: entry.span.toMs === null,
      row: rowOf.get(entry.id) ?? 0,
      label,
      title: titleOf(entry.span),
    };
  });
}
