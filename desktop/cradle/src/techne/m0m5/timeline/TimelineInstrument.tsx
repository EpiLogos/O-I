/**
 * PORT (T3, 2026-09-19): ported into the O:I cradle from QL-MEF adapters/techne/surfaces/cradle/src/techne (main @ dbff5cc == techne/t9-integrated-field, byte-identical there); import specifiers re-pointed to the cradle seam. No semantic change.
 * The M2′ Relation Field / Timeline instrument (QL-MEF #215; Wayfinder §7,
 * Dual-Reading Lock §8) — the office of becoming, efficient relation and
 * transformation. Timeline is its strongest ordinary projection, not its
 * definition: the surface moves among truthful projections over the
 * reading's own native relations and temporal facets —
 *
 *   TIMELINE · RELATIONS · CAUSE · ECHO · OPPOSITION · PHASE · ACTIVITY
 *
 * Laws this surface keeps:
 *   - the active projection is always explicit (mode bar + header), and each
 *     mode is enabled only by actual data (`projectionAvailability`); a
 *     mode with no data shows its honest reason, never a fabricated view;
 *   - relations without a temporal qualification render as trans-temporal
 *     (◇ in the gutter) — no chronology is invented for them; a dangling
 *     temporal_facet_ref is reported as unresolved, never silently dated;
 *   - epistemic standing is drawn only through the mechanical grammar in
 *     `./standing` and the owner's verbatim string rides on every edge;
 *     the legend is on the surface, so no stroke upgrades standing silently;
 *   - typed relation families stay distinct: an unrecognised relation type
 *     appears only in RELATIONS, never silently in CAUSE/ECHO/OPPOSITION;
 *   - native refs are shown verbatim (day_ref, now_ref, run_ref, session_ref,
 *     relation_ref, participant refs); derived ids are labelled derived;
 *   - no lifecycle moves through graphics: a click only narrows the
 *     DisclosureSession selection; zoom/pan/mode are LOCAL presentation
 *     state, never persisted into the session or the reading;
 *   - the M2′ ↔ 3:3 crossing fires only through the mechanical warrant in
 *     `./state` and the reading's own disclosed crossing Action — a
 *     warranted crossing asserts no harmonic/correspondential meaning;
 *   - structured state for Aletheia_2 / Technē_2 is published below the
 *     surface (`relationFieldState`), refs and Actions verbatim;
 *   - absent facets are honest empty states — the instrument fabricates
 *     nothing.
 *
 * SVG/DOM only, no chart libraries. Erasable TypeScript + JSX (Vite).
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { disclosureSession } from "../../session";
import type { TechneSurfaceProps } from "../registry";
import {
  aggregate,
  buildLanes,
  selectionFocusedOnItem,
  timelineIsEmpty,
  type TimelineItem,
} from "./lanes";
import {
  arcLayout,
  causalChains,
  cyclesOf,
  edgesForProjection,
  projectionAvailability,
  relationField,
  selectionFocusedOnRelation,
  phasesFromFacets,
  type RelationEdge,
  type RelationField,
  type RelationProjectionMode,
} from "./relations";
import { STANDING_LEGEND } from "./standing";
import { expressionCrossing, relationFieldState } from "./state";
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
const ARC_AXIS_Y = 240;
const ARC_H = 300;

const MODE_LABEL: Record<RelationProjectionMode, string> = {
  timeline: "Timeline",
  relations: "Relations",
  cause: "Cause / dependency",
  echo: "Recurrence / echo",
  opposition: "Opposition / inheritance / transformation",
  phase: "Phase / cycle",
  activity: "Activity / Run / NOW",
};
const MODE_ORDER: readonly RelationProjectionMode[] = ["timeline", "relations", "cause", "echo", "opposition", "phase", "activity"];

const MODES: readonly string[] = MODE_ORDER;

export interface TimelineInstrumentProps extends TechneSurfaceProps {
  /** Optional opening projection (e.g. a future deep link or an agency
   * request); the mode bar stays in charge afterwards. Defaults to
   * "timeline" — the strongest ordinary projection of the office. */
  initialMode?: RelationProjectionMode;
}

function trunc(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function itemRefLines(item: TimelineItem): string[] {
  const lines: string[] = [];
  if (item.day_ref) lines.push(`day ${item.day_ref}`);
  if (item.now_ref) lines.push(`now ${item.now_ref}`);
  if (item.session_ref) lines.push(`session ${item.session_ref}`);
  if (item.run_ref) lines.push(`run ${item.run_ref}`);
  if (item.attempt_ref) lines.push(`attempt ${item.attempt_ref}`);
  if (item.return_ref) lines.push(`return ${item.return_ref}`);
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

function edgeTitle(edge: RelationEdge): string {
  const lines = [
    `${edge.relation} — ${edge.from_ref} → ${edge.to_ref}`,
    `standing ${edge.standing_verbatim ?? "unknown (not disclosed by the owner)"}`,
  ];
  if (!edge.derived_id) lines.push(`relation ${edge.id}`);
  else lines.push(`derived id ${edge.id} (the owner discloses no relation_ref)`);
  if (edge.temporal.state === "dated") lines.push(`dated via ${edge.temporal.facet_ref}`);
  else if (edge.temporal.state === "trans-temporal") lines.push("trans-temporal — no date disclosed, none invented");
  else lines.push(edge.temporal.problem ?? "temporal qualification unresolved");
  if (edge.source_ref) lines.push(`source ${edge.source_ref}`);
  if (edge.evidence_refs.length) lines.push(`evidence ${edge.evidence_refs.join(", ")}`);
  if (edge.derivation_ref) lines.push(`derivation ${edge.derivation_ref}`);
  if (edge.confidence) lines.push(`confidence ${edge.confidence}`);
  if (edge.origin) lines.push(`origin ${edge.origin}${edge.origin_ref ? ` (${edge.origin_ref})` : ""}`);
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

function edgeMark(edge: RelationEdge, view: TimeRange | null, plotX: number, plotW: number): Mark | null {
  if (edge.temporal.state !== "dated" || edge.temporal.fromMs === null || edge.temporal.toMs === null || !view) return null;
  const x = plotX + project(Math.max(edge.temporal.fromMs, view.fromMs), view, plotW);
  const toX = edge.temporal.toMs >= view.toMs ? plotX + plotW : plotX + project(edge.temporal.toMs, view, plotW);
  return { x, width: Math.max(2, toX - x) };
}

export function TimelineInstrument({ session, selection, reading, capabilities, initialMode }: TimelineInstrumentProps) {
  // The active projection: LOCAL presentation state, never persisted into
  // the session or the reading. Timeline stays the default — the strongest
  // ordinary projection of the office.
  const [mode, setMode] = useState<RelationProjectionMode>(
    initialMode && MODES.includes(initialMode) ? initialMode : "timeline",
  );

  const field: RelationField | null = useMemo(() => (reading ? relationField(reading) : null), [reading]);
  const availability = useMemo(() => (reading ? projectionAvailability(reading) : []), [reading]);
  const availabilityOf = (candidate: RelationProjectionMode) => availability.find((entry) => entry.mode === candidate);

  const lanes = useMemo(() => buildLanes(reading?.temporal), [reading]);
  const domain = useMemo(() => domainFromFacets(reading?.temporal), [reading]);
  const activityLanes = useMemo(() => lanes.filter((lane) => lane.owner !== "events"), [lanes]);

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

  const shownLanes = mode === "activity" ? activityLanes : lanes;
  const hasUnpositioned = shownLanes.some((lane) => lane.items.some((item) => !item.positioned))
    || (mode === "timeline" && (field?.edges ?? []).some((edge) => edge.temporal.state !== "dated"));
  const plotX = GUTTER_W;
  const plotW = VIEW_W - GUTTER_W - RIGHT_PAD - (hasUnpositioned ? UNPOS_W : 0);
  const relationLaneShown = mode === "timeline" && (field?.edges.length ?? 0) > 0;
  const laneCount = shownLanes.length + (relationLaneShown ? 1 : 0);
  const axisY = TOP_PAD + laneCount * LANE_H + 12;
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
  const aggregations = useMemo(() => (view ? aggregate(shownLanes, view, bucketCount) : []), [shownLanes, view, bucketCount]);
  const itemById = useMemo(() => {
    const map = new Map<string, TimelineItem>();
    for (const lane of shownLanes) for (const item of lane.items) map.set(item.id, item);
    return map;
  }, [shownLanes]);

  const select = (item: TimelineItem) => {
    if (!session) return;
    disclosureSession.setSelection(selectionFocusedOnItem(session.selection, item));
  };
  const selectRelation = (edge: RelationEdge) => {
    if (!session) return;
    disclosureSession.setSelection(selectionFocusedOnRelation(session.selection, edge));
  };

  // The M2′ ↔ 3:3 crossing warrant for the current focus.
  const crossing = useMemo(
    () => (reading ? expressionCrossing(reading, selection, field ?? undefined) : null),
    [reading, selection, field],
  );
  const doCross = () => {
    if (!crossing?.warranted) return;
    disclosureSession.openInInstrument("expressions");
  };

  const focusedRefs = selection?.focus_refs ?? [];

  // Structured state for Aletheia_2 / Technē_2 — refs and Actions verbatim.
  const agencyState = useMemo(
    () => (reading ? relationFieldState(reading, mode, selection, session?.time_window ?? null) : null),
    [reading, mode, selection, session],
  );

  if (entry && !entry.available) {
    return (
      <div className="techne-timeline">
        <p className="techne-absent" role="alert">The relation field is unavailable for this subject — {entry.reason}</p>
      </div>
    );
  }

  if (!reading) {
    return (
      <div className="techne-timeline">
        <p className="techne-absent">The reading has not arrived — the relation field cannot disclose anything until it does.</p>
      </div>
    );
  }

  // --- relation-mode content ------------------------------------------------

  const renderStandingChip = (edge: RelationEdge) => (
    <span className={`techne-standing-chip`} data-standing={edge.standing_visual} title={edge.standing_verbatim ?? "standing not disclosed"}>
      {edge.standing_visual}
    </span>
  );

  const renderTemporalChip = (edge: RelationEdge) => {
    if (edge.temporal.state === "dated") {
      return <span className="techne-temporal-chip" data-temporal="dated">dated via {trunc(edge.temporal.facet_ref ?? "", 26)}</span>;
    }
    if (edge.temporal.state === "trans-temporal") {
      return <span className="techne-temporal-chip" data-temporal="trans-temporal">trans-temporal — no date, none invented</span>;
    }
    return <span className="techne-temporal-chip" data-temporal="unresolved" title={edge.temporal.problem ?? ""}>unresolved temporal ref</span>;
  };

  const renderEdgeRow = (edge: RelationEdge) => {
    const selected = focusedRefs.includes(edge.id);
    return (
      <li
        key={edge.id}
        className="techne-edge-row"
        data-selected={selected}
        data-standing={edge.standing_visual}
        role="button"
        tabIndex={0}
        aria-label={edgeTitle(edge).replace(/\n/g, "; ")}
        onClick={() => selectRelation(edge)}
        onKeyDown={(event: ReactKeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectRelation(edge);
          }
        }}
      >
        <span className="techne-edge-relation">{edge.relation}</span>
        <span className="techne-edge-flow" title={edgeTitle(edge)}>
          <code className="techne-subject">{trunc(edge.from_ref, 40)}</code>
          <span className="techne-edge-arrow">→</span>
          <code className="techne-subject">{trunc(edge.to_ref, 40)}</code>
        </span>
        {renderStandingChip(edge)}
        {renderTemporalChip(edge)}
        {edge.derived_id ? <span className="techne-derived-chip">derived id</span> : null}
      </li>
    );
  };

  const renderArcField = (edges: readonly RelationEdge[]) => {
    if (edges.length === 0) return null;
    const refs = new Set<string>();
    for (const edge of edges) {
      refs.add(edge.from_ref);
      refs.add(edge.to_ref);
    }
    const layout = arcLayout([...refs], edges, VIEW_W);
    return (
      <svg className="techne-arc-field" viewBox={`0 0 ${VIEW_W} ${ARC_H}`} role="group" aria-label={`Relation field over ${layout.nodes.length} participants and ${edges.length} relations`}>
        {layout.edges.map((arc) => {
          const edge = edges.find((candidate) => candidate.id === arc.id)!;
          const midX = (arc.fromX + arc.toX) / 2;
          const path = `M ${arc.fromX} ${ARC_AXIS_Y} Q ${midX} ${ARC_AXIS_Y + arc.controlY} ${arc.toX} ${ARC_AXIS_Y}`;
          const selected = focusedRefs.includes(edge.id);
          return (
            <g
              key={arc.id}
              className="techne-arc"
              data-standing={edge.standing_visual}
              data-temporal={edge.temporal.state}
              data-selected={selected}
              role="button"
              tabIndex={0}
              aria-label={edgeTitle(edge).replace(/\n/g, "; ")}
              onClick={() => selectRelation(edge)}
              onKeyDown={(event: ReactKeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectRelation(edge);
                }
              }}
            >
              <title>{edgeTitle(edge)}</title>
              <path className="techne-arc-path" d={path} fill="none" />
              {edge.temporal.state === "dated" ? (
                <circle className="techne-arc-tip" cx={arc.toX} cy={ARC_AXIS_Y} r={3.4} />
              ) : (
                <rect className="techne-arc-tip" x={arc.toX - 3.4} y={ARC_AXIS_Y - 3.4} width={6.8} height={6.8} transform={`rotate(45 ${arc.toX} ${ARC_AXIS_Y})`} />
              )}
            </g>
          );
        })}
        {layout.nodes.map((node) => (
          <g key={node.ref} className="techne-arc-node">
            <circle cx={node.x} cy={ARC_AXIS_Y} r={3} />
            <text x={node.x} y={ARC_AXIS_Y + 16} textAnchor="middle">{trunc(node.ref.slice(node.ref.lastIndexOf(":") + 1), 22)}</text>
            <title>{node.ref}</title>
          </g>
        ))}
      </svg>
    );
  };

  const renderRelationMode = () => {
    const availabilityEntry = availabilityOf(mode);
    if (availabilityEntry && !availabilityEntry.available) {
      return (
        <div className="techne-relation-pane">
          <p className="techne-absent" role="status">{MODE_LABEL[mode]} is not disclosed for this subject — {availabilityEntry.reason}</p>
        </div>
      );
    }
    const edges = edgesForProjection(field!.edges, mode);
    const chains = mode === "cause" ? causalChains(field!) : [];
    const cycles = mode === "opposition" || mode === "phase" ? cyclesOf(edgesForProjection(field!.edges, "opposition")) : [];
    const phases = mode === "phase" ? phasesFromFacets(reading.temporal ?? []) : [];
    return (
      <div className="techne-relation-pane">
        {mode === "relations" && field!.unclassified_relations.length > 0 && (
          <p className="techne-note">
            relations kept in the field only (no family rule claims them — they never silently become causal, echoing or oppositional): {field!.unclassified_relations.join(", ")}
          </p>
        )}
        {renderArcField(edges)}
        {mode === "cause" && chains.length > 0 && (
          <section aria-label="Causal chains">
            <p className="techne-eyebrow">Chains (the owner's own directions — no chronology inferred)</p>
            <ul className="techne-chain-list">
              {chains.map((chain, index) => (
                <li key={`chain:${index}`}>
                  {chain.map((edge, at) => (
                    <span key={edge.id}>
                      {at > 0 && <span className="techne-edge-arrow"> → </span>}
                      <button type="button" className="techne-chain-ref" onClick={() => selectRelation(edge)}>{trunc(edge.from_ref.slice(edge.from_ref.lastIndexOf(":") + 1), 24)}</button>
                      {at === chain.length - 1 && (
                        <>
                          <span className="techne-edge-arrow"> —{edge.relation}→ </span>
                          <button type="button" className="techne-chain-ref" onClick={() => selectRelation(edge)}>{trunc(edge.to_ref.slice(edge.to_ref.lastIndexOf(":") + 1), 24)}</button>
                        </>
                      )}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        )}
        {mode === "phase" && phases.length > 0 && (
          <section aria-label="Validity phases">
            <p className="techne-eyebrow">Phases (the owner's own validity intervals — open ends stay open)</p>
            <ul className="techne-edge-list">
              {phases.map((phase) => (
                <li key={phase.id} className="techne-edge-row" data-standing="sourced">
                  <span className="techne-edge-relation">valid</span>
                  <span className="techne-edge-flow">
                    <code className="techne-subject">{phase.fromMs !== null ? new Date(phase.fromMs).toISOString() : "open…"}</code>
                    <span className="techne-edge-arrow">→</span>
                    <code className="techne-subject">{phase.toMs !== null ? new Date(phase.toMs).toISOString() : "open"}</code>
                  </span>
                  {phase.uncertainty ? <span className="techne-temporal-chip" title={phase.uncertainty}>uncertain</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}
        {(mode === "opposition" || mode === "phase") && cycles.length > 0 && (
          <section aria-label="Transformation cycles">
            <p className="techne-eyebrow">Cycles (structures the owner's directions assert — not schedules)</p>
            <ul className="techne-chain-list">
              {cycles.map((cycle, index) => (
                <li key={`cycle:${index}`}>{cycle.map((edge) => (edge.derived_id ? `${edge.id} (derived)` : edge.id)).join(" → ")} → back</li>
              ))}
            </ul>
          </section>
        )}
        <section aria-label={`${MODE_LABEL[mode]} relations`}>
          <p className="techne-eyebrow">{MODE_LABEL[mode]} · {edges.length} relation{edges.length === 1 ? "" : "s"}</p>
          {edges.length > 0
            ? <ul className="techne-edge-list">{edges.map(renderEdgeRow)}</ul>
            : <p className="techne-absent">No relations in this projection — the field discloses none and fabricates none.</p>}
        </section>
      </div>
    );
  };

  // --- timeline mode ---------------------------------------------------------

  const renderTimelineMode = () => {
    const empty = timelineIsEmpty(shownLanes) && !relationLaneShown;
    if (empty) {
      const hint = (field?.edges.length ?? 0) > 0;
      return (
        <div className="techne-relation-pane">
          <p className="techne-absent">
            No temporal facets are disclosed for this subject — the timeline has nothing to place and fabricates nothing.
            {hint ? " Typed relations are disclosed: the relation field shows them without inventing dates." : " Occurrences, receipts, days, NOW clearings, sessions and runs arrive here only through the reading."}
          </p>
          {hint && (
            <button type="button" className="techne-open" onClick={() => setMode("relations")}>
              Open the relation field ({field!.edges.length} relations, trans-temporal)
            </button>
          )}
        </div>
      );
    }

    const renderRelationLane = (laneY: number) => {
      const edges = field!.edges;
      return (
        <g key="lane:relations">
          <rect className="tl-lane-track" x={plotX} y={laneY} width={plotW} height={LANE_H - 8} rx={4} />
          <text className="tl-lane-label" x={8} y={laneY + 16}>Relations</text>
          <text className="tl-lane-ref" x={8} y={laneY + 30}>
            {edges.length} typed · {edges.filter((edge) => edge.temporal.state === "dated").length} dated
          </text>
          {edges.map((edge) => {
            const selected = focusedRefs.includes(edge.id);
            const mark = edgeMark(edge, view!, plotX, plotW);
            const common = {
              className: "techne-timeline-item",
              "data-selected": selected,
              "data-standing": edge.standing_visual,
              tabIndex: 0,
              role: "button",
              "aria-label": edgeTitle(edge).replace(/\n/g, "; "),
              onClick: () => selectRelation(edge),
              onKeyDown: (event: ReactKeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectRelation(edge);
                }
              },
            };
            if (edge.temporal.state !== "dated") {
              return (
                <g key={edge.id} {...common}>
                  <title>{edgeTitle(edge)}</title>
                  <rect
                    className="tl-relation-unpositioned"
                    x={plotX + plotW + 10}
                    y={laneY + BAND_Y + 2}
                    width={12}
                    height={12}
                    transform={`rotate(45 ${plotX + plotW + 16} ${laneY + BAND_Y + 8})`}
                  />
                </g>
              );
            }
            return (
              <g key={edge.id} {...common}>
                <title>{edgeTitle(edge)}</title>
                {mark && (
                  <rect
                    className="tl-relation-band"
                    x={mark.x}
                    y={laneY + BAND_Y}
                    width={mark.width}
                    height={BAND_H}
                    rx={4}
                  />
                )}
              </g>
            );
          })}
        </g>
      );
    };

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

    return (
      <div className="techne-timeline-frame">
        <svg viewBox={`0 0 ${VIEW_W} ${svgH}`} role="group" aria-label={`Timeline over ${shownLanes.length} lanes${relationLaneShown ? " and the relation lane" : ""}`}>
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
          {shownLanes.map((lane, index) => {
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
          })}
          {relationLaneShown && renderRelationLane(TOP_PAD + shownLanes.length * LANE_H)}
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
    );
  };

  return (
    <div className="techne-timeline">
      <header className="techne-timeline-head">
        <span className="techne-eyebrow">Relation Field / Timeline</span>
        <span className="techne-projection" data-projection={mode}>projection · {MODE_LABEL[mode]}</span>
        {reading ? <span className="techne-timeline-reading">{reading.reading_ref}</span> : null}
      </header>
      <div className="techne-mode-bar" role="toolbar" aria-label="Relation field projections">
        {MODE_ORDER.map((candidate) => {
          const state = availabilityOf(candidate);
          const disabled = !state?.available;
          return (
            <button
              key={candidate}
              type="button"
              className="techne-mode"
              data-active={mode === candidate}
              disabled={disabled}
              title={disabled ? state?.reason ?? undefined : MODE_LABEL[candidate]}
              aria-pressed={mode === candidate}
              onClick={() => setMode(candidate)}
            >
              {MODE_LABEL[candidate]}{state?.available && state.count !== null ? ` (${state.count})` : ""}
            </button>
          );
        })}
      </div>
      {mode === "timeline" && (
        <div className="techne-timeline-controls">
          <button type="button" className="techne-open" aria-label="Zoom out" onClick={() => zoomBy(2)}>Zoom −</button>
          <button type="button" className="techne-open" aria-label="Zoom in" onClick={() => zoomBy(0.5)}>Zoom +</button>
          <button type="button" className="techne-open" aria-label="Pan earlier" onClick={() => panBy(-0.25)}>‹</button>
          <button type="button" className="techne-open" aria-label="Pan later" onClick={() => panBy(0.25)}>›</button>
          <button type="button" className="techne-open" aria-label="Reset view" onClick={() => setView(domain)}>Reset view</button>
          <span className="techne-timeline-zoom-note">zoom and pan are local view state</span>
        </div>
      )}
      {mode === "timeline" ? renderTimelineMode() : renderRelationMode()}
      {field && field.edges.length > 0 && (
        <div className="techne-standing-legend" aria-label="Standing legend — how relation standing is drawn">
          <p className="techne-eyebrow">Standing legend — the drawing never upgrades what the owner disclosed</p>
          <ul>
            {STANDING_LEGEND.map((legend) => (
              <li key={legend.visual} data-standing={legend.visual}>
                <span className="techne-standing-chip" data-standing={legend.visual}>{legend.label}</span> — {legend.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      {crossing && (
        <div className="techne-crossing" aria-label="M2 Expression crossing">
          {crossing.warranted ? (
            <>
              <button type="button" className="techne-open" onClick={doCross}>
                Cross to 3:3 Expression (M2 crossing)
              </button>
              <span className="techne-note">{crossing.reason}</span>
            </>
          ) : (
            <span className="techne-note">M2 → 3:3 crossing not warranted — {crossing.reason}</span>
          )}
        </div>
      )}
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
      {agencyState && (
        <details className="techne-structure" aria-label="Technē 2 structured state">
          <summary>Technē_2 structured state ({agencyState.relations.length} relations, projection {agencyState.projection})</summary>
          <pre>{JSON.stringify(agencyState, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
