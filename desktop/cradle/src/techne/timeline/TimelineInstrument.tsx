/**
 * The Timeline instrument (L5 Technē T3, Wayfinder §7/§18) — the general
 * temporal aperture over any subject whose reading carries time. It renders
 * the reading's `temporal[]` facets as lanes named for their native owner
 * kind (DAY / NOW / Session / Run / Events), over the shared lane model in
 * `./lanes` and axis math in `./scale`.
 *
 * Laws this surface keeps:
 *   - native refs are shown verbatim (day_ref on DAY bands, now_ref, run_ref,
 *     session_ref in lane gutters and every item's tooltip); nothing is
 *     re-keyed or shortened where it is carried;
 *   - occurrence and receipt stay distinct rows, outline vs filled, with
 *     their `uncertainty` notes verbatim on hover/focus;
 *   - precision is honoured: a millennium facet is a wide band, never a
 *     point; ref-only facets render as unpositioned continuity marks, never
 *     given a fabricated wall-clock position;
 *   - no lifecycle moves through graphics: a click only narrows the
 *     DisclosureSession selection (focus_refs = facet ref or derived stable
 *     id; subject and reading basis byte-identical);
 *   - zoom and pan are LOCAL presentation state, never persisted into the
 *     session or the reading;
 *   - cross-open affordances come from the reading's disclosure only;
 *   - absent facets are an honest empty state — the timeline fabricates
 *     nothing.
 *
 * SVG/DOM only, no chart libraries. Erasable TypeScript + JSX (Vite).
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { disclosureSession } from "../session";
import type { TechneSurfaceProps } from "../registry";
import {
  aggregate,
  buildLanes,
  selectionFocusedOnItem,
  timelineIsEmpty,
  type TimelineItem,
  type TimelineLane,
} from "./lanes";
import {
  domainFromFacets,
  instantOffsetMs,
  project,
  ticksForDomain,
  type TimeRange,
} from "./scale";
import "./timeline.css";

const VIEW_W = 1000;
const GUTTER_W = 190;
const RIGHT_PAD = 14;
const UNPOS_W = 30;
const TOP_PAD = 10;
const LANE_H = 44;
const BAND_Y = 12;
const BAND_H = 20;
const AXIS_H = 44;
const MIN_SPAN_MS = 1;

function trunc(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function itemRefLines(item: TimelineItem): string[] {
  const lines: string[] = [];
  if (item.day_ref) lines.push(`day ${item.day_ref}`);
  if (item.now_ref) lines.push(`now ${item.now_ref}`);
  if (item.session_ref) lines.push(`session ${item.session_ref}`);
  if (item.run_ref) lines.push(`run ${item.run_ref}`);
  if (item.source_ref) lines.push(`source ${item.source_ref}`);
  return lines;
}

function itemTitle(item: TimelineItem): string {
  const span = item.instant
    ? item.instant
    : item.interval
      ? `${item.interval.from ?? "…"} → ${item.interval.to ?? "…"}`
      : null;
  const lines = [`${item.kind}${item.precision ? ` (${item.precision})` : ""}${span ? ` — ${span}` : " — no wall-clock position disclosed"}`];
  lines.push(...itemRefLines(item));
  if (item.uncertainty) lines.push(`uncertainty — ${item.uncertainty}`);
  return lines.join("\n");
}

interface Mark {
  x: number;
  width: number;
}

function itemMark(item: TimelineItem, view: TimeRange | null, plotX: number, plotW: number): Mark | null {
  if (!item.positioned || item.fromMs === null || item.toMs === null || !view) return null;
  const x = plotX + project(Math.max(item.fromMs, view.fromMs), view, plotW);
  const toX = item.toMs >= view.toMs ? plotX + plotW : plotX + project(item.toMs, view, plotW);
  return { x, width: Math.max(1.5, toX - x) };
}

export function TimelineInstrument({ session, selection, reading, capabilities }: TechneSurfaceProps) {
  const lanes = useMemo(() => buildLanes(reading?.temporal), [reading]);
  const domain = useMemo(() => domainFromFacets(reading?.temporal), [reading]);
  const empty = timelineIsEmpty(lanes);

  const entry = capabilities?.instruments.find((candidate) => candidate.instrument === "timeline");
  const timelineNotes = [
    ...(capabilities?.degraded ?? []).filter((note) => note.instrument === "timeline").map((note) => `degraded — ${note.reason}`),
    ...(capabilities?.suggestions ?? []).filter((note) => note.instrument === "timeline").map((note) => `suggested — ${note.reason}`),
  ];
  const crossOpen = (capabilities?.instruments ?? []).filter((candidate) => candidate.available && candidate.instrument !== "timeline");

  // Zoom/pan: local presentation state only; it resets when the reading's
  // honest domain changes and is never written into session or reading.
  const [view, setView] = useState<TimeRange | null>(null);
  // Layout effect: the view derives from the reading's domain before first
  // paint, so marks never flash into place.
  useLayoutEffect(() => {
    setView(domain);
  }, [domain]);
  const dragRef = useRef<{ x: number; view: TimeRange } | null>(null);

  const hasUnpositioned = lanes.some((lane) => lane.items.some((item) => !item.positioned));
  const plotX = GUTTER_W;
  const plotW = VIEW_W - GUTTER_W - RIGHT_PAD - (hasUnpositioned ? UNPOS_W : 0);
  const axisY = TOP_PAD + lanes.length * LANE_H + 12;
  const svgH = axisY + AXIS_H;

  const clampView = (candidate: TimeRange): TimeRange => {
    if (!domain) return candidate;
    const domainSpan = domain.toMs - domain.fromMs;
    const span = Math.min(Math.max(candidate.toMs - candidate.fromMs, MIN_SPAN_MS), domainSpan);
    const from = Math.min(Math.max(candidate.fromMs, domain.fromMs), domain.toMs - span);
    return { fromMs: from, toMs: from + span };
  };
  const zoomBy = (factor: number) => {
    if (!view) return;
    const centre = (view.fromMs + view.toMs) / 2;
    const span = (view.toMs - view.fromMs) * factor;
    setView(clampView({ fromMs: centre - span / 2, toMs: centre + span / 2 }));
  };
  const panBy = (fraction: number) => {
    if (!view) return;
    const shift = fraction * (view.toMs - view.fromMs);
    setView(clampView({ fromMs: view.fromMs + shift, toMs: view.toMs + shift }));
  };
  const panByPointer = (event: ReactPointerEvent<SVGRectElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const scale = VIEW_W / (svg.getBoundingClientRect().width || VIEW_W);
    const deltaMs = ((event.clientX - drag.x) * scale / plotW) * (drag.view.toMs - drag.view.fromMs);
    setView(clampView({ fromMs: drag.view.fromMs - deltaMs, toMs: drag.view.toMs - deltaMs }));
  };

  // The civil frame for tick labels is the reading's own declared offset —
  // derived from its first positioned instant, never guessed from a tz database.
  const labelOffsetMs = useMemo(() => {
    const first = (reading?.temporal ?? []).find((facet) => facet.instant);
    return first?.instant ? instantOffsetMs(first.instant) : 0;
  }, [reading]);
  const ticks = useMemo(
    () => (view ? ticksForDomain(view, { offsetMs: labelOffsetMs, targetTicks: Math.max(3, Math.floor(plotW / 130)) }) : []),
    [view, labelOffsetMs, plotW],
  );

  // Broad-zoom compression: a pure view projection; the reading is untouched.
  const bucketCount = Math.max(8, Math.floor(plotW / 14));
  const aggregations = useMemo(() => (view ? aggregate(lanes, view, bucketCount) : []), [lanes, view, bucketCount]);
  const itemById = useMemo(() => {
    const map = new Map<string, TimelineItem>();
    for (const lane of lanes) for (const item of lane.items) map.set(item.id, item);
    return map;
  }, [lanes]);

  const select = (item: TimelineItem) => {
    if (!session) return;
    disclosureSession.setSelection(selectionFocusedOnItem(session.selection, item));
  };

  if (entry && !entry.available) {
    return (
      <div className="techne-timeline">
        <p className="techne-absent" role="alert">The timeline is unavailable for this subject — {entry.reason}</p>
      </div>
    );
  }

  if (!reading) {
    return (
      <div className="techne-timeline">
        <p className="techne-absent">The reading has not arrived — the timeline cannot place anything until it does.</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="techne-timeline">
        <p className="techne-absent">
          No temporal facets are disclosed for this subject — the timeline has nothing to place and fabricates nothing.
          Occurrences, receipts, days, NOW clearings, sessions and runs arrive here only through the reading.
        </p>
      </div>
    );
  }

  const renderItem = (item: TimelineItem, laneY: number) => {
    const selected = selection?.focus_refs?.includes(item.id) ?? false;
    const outline = item.kind === "occurrence";
    const receipt = item.kind === "receipt";
    const fill = receipt ? "var(--oi-accent)" : outline ? "transparent" : "var(--oi-muted)";
    const stroke = outline ? "var(--oi-foreground)" : "none";
    const mark = itemMark(item, view!, plotX, plotW);
    const title = itemTitle(item);
    const common = {
      className: "techne-timeline-item",
      "data-selected": selected,
      tabIndex: 0,
      role: "button",
      "aria-label": title.replace(/\n/g, "; "),
      onClick: () => select(item),
      onKeyDown: (event: ReactKeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(item);
        }
      },
    };
    return (
      <g key={item.id} {...common}>
        <title>{title}</title>
        {!item.positioned ? (
          <rect
            className="tl-unpositioned"
            x={plotX + plotW + 10}
            y={laneY + BAND_Y}
            width={14}
            height={BAND_H}
            rx={3}
          />
        ) : mark && mark.width < 3 ? (
          <circle
            className="tl-shape"
            cx={mark.x + mark.width / 2}
            cy={laneY + BAND_Y + BAND_H / 2}
            r={4.5}
            fill={fill}
            stroke={stroke}
            strokeWidth={outline ? 1.6 : 0}
          />
        ) : (
          mark && (
            <rect
              className="tl-shape"
              x={mark.x}
              y={laneY + BAND_Y}
              width={mark.width}
              height={BAND_H}
              rx={4}
              fill={fill}
              stroke={stroke}
              strokeWidth={outline ? 1.6 : 0}
            />
          )
        )}
        {item.kind === "day" && item.day_ref && mark && mark.width >= 150 && (
          <text className="tl-band-label" x={mark.x + 6} y={laneY + BAND_Y + 13}>{trunc(item.day_ref, 34)}</text>
        )}
        {item.kind === "run" && item.run_ref && mark && mark.width >= 150 && (
          <text className="tl-band-label" x={mark.x + 6} y={laneY + BAND_Y + 13}>{trunc(item.run_ref, 34)}</text>
        )}
      </g>
    );
  };

  const renderLane = (lane: TimelineLane, index: number) => {
    const laneY = TOP_PAD + index * LANE_H;
    const aggregation = aggregations.find((candidate) => candidate.lane_id === lane.id);
    const compressed = (aggregation?.buckets ?? []).some((bucket) => bucket.count > 1);
    const laneRef = lane.ref;
    return (
      <g key={lane.id}>
        <rect className="tl-lane-track" x={plotX} y={laneY} width={plotW} height={LANE_H - 8} rx={4} />
        <text className="tl-lane-label" x={8} y={laneY + 16}>{lane.label}</text>
        <text className="tl-lane-ref" x={8} y={laneY + 30}>
          {laneRef ? trunc(laneRef, 30) : "no continuity ref"}
          {hasUnpositioned && lane.items.some((item) => !item.positioned) ? " · ◇ unpositioned" : ""}
        </text>
        {laneRef ? <title>{laneRef}</title> : null}
        {!compressed && lane.items.map((item) => renderItem(item, laneY))}
        {compressed && (aggregation?.buckets ?? []).map((bucket) => {
          const x0 = plotX + project(Math.max(bucket.fromMs, view!.fromMs), view!, plotW);
          const x1 = bucket.toMs >= view!.toMs ? plotX + plotW : plotX + project(bucket.toMs, view!, plotW);
          if (bucket.count === 1) {
            const item = itemById.get(bucket.item_ids[0]);
            return item ? renderItem(item, laneY) : null;
          }
          return (
            <g key={`bucket:${bucket.fromMs}`}>
              <title>{`${bucket.count} ${lane.label} items compressed between ${new Date(bucket.fromMs).toISOString()} and ${new Date(bucket.toMs).toISOString()} — zoom in to separate them`}</title>
              <rect className="tl-count-pill" x={x0 + 1} y={laneY + BAND_Y} width={Math.max(2, x1 - x0 - 2)} height={BAND_H} rx={4} />
              <text className="tl-count-label" x={(x0 + x1) / 2} y={laneY + BAND_Y + 13} textAnchor="middle">×{bucket.count}</text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div className="techne-timeline">
      <header className="techne-timeline-head">
        <span className="techne-eyebrow">Timeline</span>
        {reading ? <span className="techne-timeline-reading">{reading.reading_ref}</span> : null}
      </header>
      <div className="techne-timeline-controls">
        <button type="button" className="techne-open" aria-label="Zoom out" onClick={() => zoomBy(2)}>Zoom −</button>
        <button type="button" className="techne-open" aria-label="Zoom in" onClick={() => zoomBy(0.5)}>Zoom +</button>
        <button type="button" className="techne-open" aria-label="Pan earlier" onClick={() => panBy(-0.25)}>‹</button>
        <button type="button" className="techne-open" aria-label="Pan later" onClick={() => panBy(0.25)}>›</button>
        <button type="button" className="techne-open" aria-label="Reset view" onClick={() => setView(domain)}>Reset view</button>
        <span className="techne-timeline-zoom-note">zoom and pan are local view state</span>
      </div>
      <div className="techne-timeline-frame">
        <svg viewBox={`0 0 ${VIEW_W} ${svgH}`} role="group" aria-label={`Timeline over ${lanes.length} lanes`}>
          {view && (
            <rect
              x={plotX}
              y={TOP_PAD}
              width={plotW}
              height={axisY - TOP_PAD + 24}
              fill="transparent"
              style={{ cursor: "grab", touchAction: "none" }}
              onPointerDown={(event) => {
                if (!view) return;
                dragRef.current = { x: event.clientX, view };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={panByPointer}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
            />
          )}
          {lanes.map(renderLane)}
          {view && (
            <>
              <line className="tl-axis-line" x1={plotX} y1={axisY} x2={plotX + plotW} y2={axisY} />
              {ticks.map((tick) => {
                const x = plotX + project(tick.ms, view, plotW);
                if (x < plotX - 0.5 || x > plotX + plotW + 0.5) return null;
                return (
                  <g key={tick.ms}>
                    <line className="tl-tick-line" x1={x} y1={axisY} x2={x} y2={axisY + 5} />
                    <text className="tl-tick-label" x={x} y={axisY + 18} textAnchor="middle">{tick.label}</text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
      {timelineNotes.length > 0 && (
        <ul className="techne-timeline-notes" aria-label="Timeline disclosure notes">
          {timelineNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
      {crossOpen.length > 0 && (
        <nav className="techne-instruments" aria-label="Open the selection in another instrument">
          {crossOpen.map((candidate) => (
            <button
              key={candidate.instrument}
              type="button"
              className="techne-open"
              onClick={() => disclosureSession.openInInstrument(candidate.instrument)}
            >
              Open in {candidate.instrument}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
