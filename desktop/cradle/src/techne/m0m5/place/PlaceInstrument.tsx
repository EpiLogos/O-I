/**
 * PORT (T3, 2026-09-19): ported into the O:I cradle from QL-MEF adapters/techne/surfaces/cradle/src/techne (main @ dbff5cc == techne/t9-integrated-field, byte-identical there); import specifiers re-pointed to the cradle seam. No semantic change.
 * The World / Places instrument surface (L5 Technē M4′, #217) — the
 * situated-whole aperture over `TechnePlaceFacet` readings, of which Map,
 * Street and Globe are the concrete spatial interaction body (presentations
 * of the SAME reading data, `modes.ts`), never the office itself and never a
 * spatial store. Rendered schematically in SVG — lat/lon into the view, no
 * tiles, no basemap dependency.
 *
 * Laws carried here:
 *   - camera, zoom, mode, the movement overlay and the time filter are LOCAL
 *     presentation state; the time filter seeds from the shared session
 *     `time_window` when the session carries one, and filtering never
 *     remints Place identity;
 *   - the hard geography relations (OCCURRED_AT, LOCATED_IN, OPERATED_IN,
 *     TRAVELLED_TO, MYTH_LOCATED_AT) render verbatim and stay visibly
 *     distinct — a mythic location never renders as a historical one;
 *   - precision is data: the four renderings (solid / halo / outline /
 *     no-coordinate) stay visually distinct and uncertainty is never
 *     upgraded to look nicer;
 *   - the shared selection is honoured: a focus set by another instrument
 *     (e.g. a Journey Scene binding a real Place ref) selects that place
 *     here (`placeFocusFromSession`), and clicking a place sets the
 *     DisclosureSession selection through `selectionForPlace` (focus_refs =
 *     [place_ref], refs verbatim);
 *   - the wider reference-frame depth (M1 harmonic, M2 planetary, M3
 *     world-clock, M4 Nara/EarthBody) is CONSUMED from the reading and its
 *     producers — never recomputed here. Producer depth that is not callable
 *     stays explicitly unavailable with its reason (`world.ts`);
 *   - the 3:3 crossing to the current Nara/Expression world is offered from
 *     the reading's own disclosure (application cuts) and carries the same
 *     occasion and session basis; private Nara state stays private — only
 *     its constraint is named;
 *   - native Actions are ROUTED, never executed: receipts show owner,
 *     authority and effects (the Technē_4 operation path);
 *   - absent facets are data: an empty honest state, never an error.
 */
import { useEffect, useId, useMemo, useState } from "react";
import "../chrome.css";
import "./place.css";
import { resolveActionRoute, techneSource } from "../adapter";
import type { TechneActionReceipt } from "../../contract";
import { disclosureSession } from "../../session";
import type { TechneSurfaceProps } from "../registry";
import {
  PLACE_MODES,
  placeState,
  renderForMode,
  renderStreetModel,
  type PlaceMode,
  type StreetModel,
} from "./modes";
import {
  DEFAULT_CAMERA,
  projectEquirect,
  type CameraState,
  type PlaceMarker,
  type ProjectedEdge,
} from "./project";
import { hierarchyInWindow, placesInWindow, validInWindow, type TimeWindow } from "./filter";
import { crossOpenTargets, placeFocusFromSession, selectionForPlace } from "./register";
import {
  GEOGRAPHY_RELATIONS,
  relationStandingClass,
  worldState,
  type RelationStandingClass,
} from "./world";

interface MarkerShape {
  place_ref: string;
  precision: string;
  relation: string | null;
  standingClass: RelationStandingClass;
  marker: PlaceMarker;
  label: string | null;
  position: { x: number; y: number } | null;
  rings: Array<Array<{ x: number; y: number }>> | null;
}

const VIEW = { width: 720, height: 360 };

function relationTitle(place: MarkerShape): string {
  const relation = place.relation ? `${place.relation} (${place.standingClass})` : "relation not disclosed";
  return `${place.label ?? place.place_ref} — ${relation} · ${place.marker.note}`;
}

function PlaceMarkerView({ place, selected, onSelect }: { place: MarkerShape; selected: boolean; onSelect: (placeRef: string) => void }) {
  const title = relationTitle(place);
  const state = {
    "data-precision": place.precision,
    "data-selected": selected,
    "data-standing": place.standingClass,
    ...(place.relation ? { "data-relation": place.relation } : {}),
  };
  if (place.marker.kind === "no-coordinate") {
    // The honest register: a distinct marker at the lower edge, identity still shown.
    const x = place.position?.x ?? 24;
    const y = place.position?.y ?? VIEW.height - 18;
    return (
      <g className="techne-place-marker" {...state} role="button" aria-pressed={selected} onClick={() => onSelect(place.place_ref)}>
        <title>{title}</title>
        <rect className="techne-place-nocoord-box" x={x - 5} y={y - 5} width={10} height={10} />
        <text className="techne-place-label" x={x + 9} y={y + 4}>{place.label ?? "(no coordinate)"}</text>
      </g>
    );
  }
  if (place.rings && place.rings.length > 0) {
    return (
      <g className="techne-place-marker" {...state} role="button" aria-pressed={selected} onClick={() => onSelect(place.place_ref)}>
        <title>{title}</title>
        {place.rings.map((ring, index) => (
          <polyline key={index} className="techne-place-outline" points={ring.map((point) => `${point.x},${point.y}`).join(" ")} />
        ))}
      </g>
    );
  }
  if (!place.position) return null;
  const { x, y } = place.position;
  return (
    <g className="techne-place-marker" {...state} role="button" aria-pressed={selected} onClick={() => onSelect(place.place_ref)}>
      <title>{title}</title>
      {place.marker.kind === "solid" && <circle className="techne-place-dot" cx={x} cy={y} r={4} />}
      {place.marker.kind === "halo" && (
        <>
          <circle className="techne-place-halo" cx={x} cy={y} r={9} />
          <circle className="techne-place-dot" cx={x} cy={y} r={3} />
        </>
      )}
      {place.marker.kind === "outline" && <circle className="techne-place-outline" cx={x} cy={y} r={5} fill="none" />}
      <text className="techne-place-label" x={x + 8} y={y - 6}>{place.label ?? place.place_ref}</text>
    </g>
  );
}

function DetailRows({ detail, window: timeWindow }: { detail: StreetModel; window: TimeWindow }) {
  if (!detail.place) {
    return <p className="techne-absent">No place stands in this view — widen the window or clear the filter.</p>;
  }
  const validity = `${detail.valid_from ?? "open"} → ${detail.valid_to ?? "open"}`;
  const geometry = detail.geometry.kind === "point"
    ? `point · ${detail.geometry.lon}, ${detail.geometry.lat}`
    : detail.geometry.kind === "polygon"
      ? `polygon · ${detail.geometry.vertices} vertices`
      : "no coordinate disclosed";
  const standingHierarchy = new Set(hierarchyInWindow(detail.place, timeWindow).map((entry) => entry.place_ref));
  return (
    <div className="techne-place-detail-body">
      <code className="techne-place-ref" title="Place ref">{detail.place_ref}</code>
      <dl className="techne-place-rows">
        <dt>relation</dt>
        <dd data-standing={relationStandingClass(detail.relation)}>
          {detail.relation ?? "(not disclosed)"}
          {relationStandingClass(detail.relation) === "mythic" ? " — mythic standing, not a historical site" : ""}
        </dd>
        <dt>standing name</dt>
        <dd>{detail.standing_name ?? "(none disclosed)"}</dd>
        <dt>names</dt>
        <dd>
          {detail.names.length === 0 ? "(none disclosed)" : detail.names.map((name, index) => (
            <span key={index} className="techne-place-name-row">
              {name.name} <span className="techne-place-validity">{name.valid_from ?? "open"} → {name.valid_to ?? "open"}</span>
            </span>
          ))}
        </dd>
        <dt>precision</dt>
        <dd data-precision={detail.precision}>{detail.precision} — {detail.precision_note}</dd>
        <dt>uncertainty</dt>
        <dd data-uncertainty={detail.uncertainty ? "disclosed" : "none"}>{detail.uncertainty ?? "(none disclosed)"}</dd>
        <dt>geometry</dt>
        <dd>{geometry}</dd>
        <dt>validity</dt>
        <dd>{validity}</dd>
        <dt>hierarchy</dt>
        <dd>
          {detail.hierarchy.length === 0 ? "(none disclosed)" : detail.hierarchy.map((row, index) => (
            <span key={index} className="techne-place-name-row" data-standing={standingHierarchy.has(row.place_ref) ? "standing" : "lapsed"}>
              {row.relation} · {row.parent_name ?? row.place_ref}{" "}
              <span className="techne-place-validity">{row.valid_from ?? "open"} → {row.valid_to ?? "open"}</span>
              {standingHierarchy.has(row.place_ref) ? "" : " — lapsed in this window"}
            </span>
          ))}
        </dd>
        <dt>source</dt>
        <dd>{detail.source_ref ? <code className="techne-place-ref">{detail.source_ref}</code> : "(none disclosed)"}</dd>
        {detail.observer_frame && (
          <>
            <dt>observer frame</dt>
            <dd><code className="techne-place-ref">{detail.observer_frame}</code></dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function PlaceInstrument({ session, reading }: TechneSurfaceProps) {
  const state = placeState(reading);
  const [mode, setMode] = useState<PlaceMode>("map");
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [draft, setDraft] = useState({ from: "", to: "" });
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [movementOverlay, setMovementOverlay] = useState(false);
  const [receipt, setReceipt] = useState<TechneActionReceipt | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const clipId = `techne-place-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // The local time filter seeds from the shared session window when it moves.
  const sessionFrom = session?.time_window?.from ?? null;
  const sessionTo = session?.time_window?.to ?? null;
  useEffect(() => {
    setDraft({ from: sessionFrom ?? "", to: sessionTo ?? "" });
  }, [sessionFrom, sessionTo]);

  const timeWindow: TimeWindow = { from: draft.from.trim() || null, to: draft.to.trim() || null };
  const visible = useMemo(
    () => placesInWindow(state.facets, timeWindow),
    [state.facets, draft.from, draft.to],
  );

  // The shared selection is honoured: focus set by another instrument (e.g.
  // a Journey Scene frame binding a real Place ref) selects that place here.
  const sessionFocus = placeFocusFromSession(session, state.facets);
  useEffect(() => {
    if (sessionFocus) setSelectedRef(sessionFocus);
  }, [sessionFocus]);

  const model = renderForMode(mode, visible, { camera, window: timeWindow, selectedRef });
  const detail = renderStreetModel(visible, { window: timeWindow, selectedRef });
  const targets = crossOpenTargets(reading);
  const world = useMemo(
    () => worldState(reading, { mode, window: timeWindow, selectedRef }),
    [reading, mode, draft.from, draft.to, selectedRef],
  );
  const route = world?.route ?? null;

  // The 3:3 crossing is the reading's own disclosure: the expressions entry
  // offers it, and a disclosed application cut must also admit the conjugate
  // reading. The occasion and session basis ride the shared session unchanged.
  const expressionsTarget = targets.find((target) => target.instrument === "expressions");
  const conjugateCut = world?.application_cuts?.find((cut) => cut.cut === "3:3-conjugate") ?? null;
  const crossingAvailable = Boolean(expressionsTarget) && conjugateCut?.available !== false;
  const crossingBlockedReason = conjugateCut?.available === false
    ? conjugateCut.reason ?? "the 3:3 conjugate reading is not available for this subject"
    : null;
  // The cut gate governs every expressions affordance, the rail's included.
  const railTargets = crossingAvailable ? targets : targets.filter((target) => target.instrument !== "expressions");

  const selectPlace = (placeRef: string) => {
    setSelectedRef(placeRef);
    if (session) disclosureSession.setSelection(selectionForPlace(session, placeRef));
  };

  if (state.status === "no-reading" || state.status === "unavailable") {
    return (
      <div className="oi-techne techne-place">
        <p className="techne-absent" role="note">{state.status === "no-reading" ? state.reason : `Place unavailable — ${state.reason}`}</p>
      </div>
    );
  }

  const projection = model.mode === "map" ? model.projection : null;
  const globe = model.mode === "globe" ? model : null;
  const drawnEdges: ProjectedEdge[] = model.mode === "map"
    ? model.projection.edges.filter((edge) => edge.from && edge.to && validInWindow(edge.valid_from, edge.valid_to, timeWindow))
    : model.mode === "globe"
      ? model.edges.filter((edge) => edge.from && edge.to)
      : [];
  const mapEdges = model.mode === "map" ? drawnEdges : [];
  const globeEdges = model.mode === "globe" ? drawnEdges : [];

  // The movement overlay: a presentation ordering of the reading's own
  // TRAVELLED_TO facets (`world.ts` owns the honesty note); drawn only when
  // every stop projects in the current body.
  const overlayStops = movementOverlay && route
    ? route.stops
        .map((stop) => ({
          stop,
          point: projection?.places.find((place) => place.place_ref === stop.place_ref)?.position
            ?? globe?.places.find((place) => place.place_ref === stop.place_ref)?.position
            ?? null,
        }))
        .filter((entry): entry is { stop: typeof route.stops[number]; point: { x: number; y: number } } => entry.point !== null)
    : [];
  const overlayDrawn = overlayStops.length >= 2;

  const graticule = [];
  if (projection) {
    for (let lon = -150; lon <= 150; lon += 30) {
      const a = projectEquirect(lon, 90, projection.bounds, VIEW.width, VIEW.height);
      const b = projectEquirect(lon, -90, projection.bounds, VIEW.width, VIEW.height);
      graticule.push(<line key={`lon:${lon}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const a = projectEquirect(-180, lat, projection.bounds, VIEW.width, VIEW.height);
      const b = projectEquirect(180, lat, projection.bounds, VIEW.width, VIEW.height);
      graticule.push(<line key={`lat:${lat}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }
  }

  const windowSummary = timeWindow.from || timeWindow.to
    ? `window ${timeWindow.from ?? "open"} → ${timeWindow.to ?? "open"}`
    : "no window — every valid facet stands";

  const source = techneSource();
  const routeWorldAction = (actionRef: string) => {
    if (!reading || !source) return;
    setRoutingError(null);
    try {
      const routed = resolveActionRoute(reading, {
        action_ref: actionRef,
        subject_ref: reading.subject.subject_ref,
        selection_ref: session?.selection.selection_ref ?? null,
      });
      setReceipt(routed);
    } catch (cause: unknown) {
      setRoutingError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="oi-techne techne-place">
      <p className="techne-place-office" aria-label="Instrument office">M4′ · World / Places — situated whole · place · reference frame · Earth relation</p>

      <div className="techne-place-rail" role="toolbar" aria-label="World presentations, camera and time filter">
        <span className="techne-place-rail-group" role="group" aria-label="Presentation mode">
          {PLACE_MODES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="oi-techne-tool"
              aria-pressed={mode === candidate}
              onClick={() => setMode(candidate)}
            >
              {candidate}
            </button>
          ))}
        </span>
        <span className="oi-techne-divider" />
        <label className="techne-place-field">
          zoom
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.1}
            value={camera.zoom}
            onChange={(event) => setCamera({ ...camera, zoom: Number(event.target.value) })}
          />
        </label>
        {mode === "globe" && (
          <span className="techne-place-rail-group" role="group" aria-label="Globe centre">
            <label className="techne-place-field">
              lon
              <input type="range" min={-180} max={180} step={1} value={camera.lon}
                onChange={(event) => setCamera({ ...camera, lon: Number(event.target.value) })} />
            </label>
            <label className="techne-place-field">
              lat
              <input type="range" min={-90} max={90} step={1} value={camera.lat}
                onChange={(event) => setCamera({ ...camera, lat: Number(event.target.value) })} />
            </label>
          </span>
        )}
        <span className="oi-techne-divider" />
        <label className="techne-place-field">
          from
          <input
            className="techne-place-input"
            type="text"
            value={draft.from}
            placeholder="1675"
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label className="techne-place-field">
          to
          <input
            className="techne-place-input"
            type="text"
            value={draft.to}
            placeholder="1700"
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
        <button type="button" className="techne-open" onClick={() => setDraft({ from: "", to: "" })}>clear window</button>
        {route && (
          <>
            <span className="oi-techne-divider" />
            <label className="techne-place-field techne-place-overlay-toggle">
              <input
                type="checkbox"
                checked={movementOverlay}
                onChange={(event) => setMovementOverlay(event.target.checked)}
              />
              movement overlay
            </label>
          </>
        )}
        <span className="oi-techne-divider" />
        <span className="techne-place-rail-group" role="group" aria-label="Open this selection in another instrument">
          {railTargets.map((target) => (
            <button key={target.instrument} type="button" className="techne-open"
              onClick={() => disclosureSession.openInInstrument(target.instrument)}>
              Open in {target.instrument}
            </button>
          ))}
        </span>
      </div>

      <div className="techne-place-legend" role="group" aria-label="Place relations in view — the hard geography distinctions, verbatim">
        <span className="techne-eyebrow">relations in view</span>
        {GEOGRAPHY_RELATIONS.map((relation) => {
          const count = visible.filter((facet) => facet.relation === relation).length;
          return (
            <span key={relation} className="techne-place-relation-chip" data-standing={relationStandingClass(relation)} data-empty={count === 0}>
              {relation} · {count}
            </span>
          );
        })}
        {world && world.relations.some((group) => group.standingClass === "owner-vocabulary") && (
          <span className="techne-place-relation-chip" data-standing="owner-vocabulary">
            owner vocabulary (verbatim) · {world.relations.filter((group) => group.standingClass === "owner-vocabulary").reduce((total, group) => total + group.facets.length, 0)}
          </span>
        )}
      </div>

      {state.status === "empty" && <p className="techne-absent" role="note">{state.reason}</p>}

      <div className="techne-place-stage">
        {projection && (
          <svg
            className="techne-place-map"
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`World map — ${visible.length} places in view`}
          >
            {graticule.length > 0 && <g className="techne-place-graticule">{graticule}</g>}
            {mapEdges.map((edge, index) => (
              <line key={index} className="techne-place-edge" x1={edge.from!.x} y1={edge.from!.y} x2={edge.to!.x} y2={edge.to!.y} />
            ))}
            {overlayDrawn && projection && (
              <polyline
                className="techne-place-route"
                data-overlay="movement"
                points={overlayStops.map((entry) => `${entry.point.x},${entry.point.y}`).join(" ")}
              />
            )}
            {model.mode === "map" && model.projection.places.map((place) => (
              <PlaceMarkerView
                key={place.place_ref}
                place={{
                  place_ref: place.place_ref,
                  precision: place.precision,
                  relation: place.relation,
                  standingClass: relationStandingClass(place.relation),
                  marker: place.marker,
                  label: place.label,
                  position: place.position,
                  rings: place.rings,
                }}
                selected={selectedRef === place.place_ref}
                onSelect={selectPlace}
              />
            ))}
          </svg>
        )}

        {globe && (
          <svg
            className="techne-place-map"
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`World globe — ${globe.places.filter((place) => place.position).length} places on the front hemisphere`}
          >
            <defs>
              <clipPath id={clipId}><circle cx={globe.disc.cx} cy={globe.disc.cy} r={globe.disc.r} /></clipPath>
            </defs>
            <circle className="techne-place-globe-disc" cx={globe.disc.cx} cy={globe.disc.cy} r={globe.disc.r} />
            <g className="techne-place-graticule" clipPath={`url(#${clipId})`}>
              <line x1={globe.disc.cx - globe.disc.r} y1={globe.disc.cy} x2={globe.disc.cx + globe.disc.r} y2={globe.disc.cy} />
              <line x1={globe.disc.cx} y1={globe.disc.cy - globe.disc.r} x2={globe.disc.cx} y2={globe.disc.cy + globe.disc.r} />
              <ellipse cx={globe.disc.cx} cy={globe.disc.cy} rx={globe.disc.r / 2} ry={globe.disc.r} />
              <ellipse cx={globe.disc.cx} cy={globe.disc.cy} rx={globe.disc.r} ry={globe.disc.r / 2} />
            </g>
            <g clipPath={`url(#${clipId})`}>
              {globeEdges.map((edge, index) => (
                <line key={index} className="techne-place-edge" x1={edge.from!.x} y1={edge.from!.y} x2={edge.to!.x} y2={edge.to!.y} />
              ))}
              {overlayDrawn && (
                <polyline
                  className="techne-place-route"
                  data-overlay="movement"
                  points={overlayStops.map((entry) => `${entry.point.x},${entry.point.y}`).join(" ")}
                />
              )}
              {globe.places.map((place) => (
                <PlaceMarkerView
                  key={place.place_ref}
                  place={{
                    place_ref: place.place_ref,
                    precision: place.precision,
                    relation: place.relation,
                    standingClass: relationStandingClass(place.relation),
                    marker: place.marker,
                    label: place.label,
                    position: place.position,
                    rings: place.rings,
                  }}
                  selected={selectedRef === place.place_ref}
                  onSelect={selectPlace}
                />
              ))}
            </g>
          </svg>
        )}

        {model.mode === "street" && (
          <section className="techne-place-detail oi-techne-panel oi-techne-panel--opaque techne-place-detail--main" aria-label="Place detail">
            <h3 className="techne-place-detail-title">street — single place</h3>
            <DetailRows detail={detail} window={timeWindow} />
          </section>
        )}

        {model.mode !== "street" && selectedRef && detail.place && (
          <aside className="techne-place-detail oi-techne-panel oi-techne-panel--opaque" aria-label="Place detail">
            <h3 className="techne-place-detail-title">place detail</h3>
            <DetailRows detail={detail} window={timeWindow} />
          </aside>
        )}
      </div>

      {route && (
        <p className="techne-place-route-note" role="note">{route.note}</p>
      )}

      {world && (
        <section className="techne-place-world oi-techne-panel oi-techne-panel--opaque" aria-label="World reference frame and situated depth">
          <h3 className="techne-place-detail-title">world — reference frame · occasion · depth</h3>

          <ol className="techne-place-ladder" aria-label="Reference frame ladder">
            {world.ladder.map((rung) => (
              <li key={rung.rung} className="techne-place-rung" data-availability={rung.availability}>
                <span className="techne-place-rung-label">{rung.label}</span>
                {rung.availability === "disclosed" ? (
                  <span className="techne-place-rung-detail">
                    {rung.disclosed.map((item, index) => <code key={index} className="techne-place-ref">{item}</code>)}
                  </span>
                ) : (
                  <span className="techne-place-rung-reason">{rung.reason}</span>
                )}
              </li>
            ))}
          </ol>

          <div className="techne-place-world-grid">
            <div className="techne-place-world-block" aria-label="Carried world occasion">
              <p className="techne-eyebrow">carried world occasion</p>
              {[...world.occasion.day_refs, ...world.occasion.now_refs, ...world.occasion.session_refs, ...world.occasion.run_refs].length === 0
                ? <p className="techne-absent">The reading carries no DAY/NOW/session/run occasion refs.</p>
                : (
                  <ul className="techne-instruments">
                    {[...world.occasion.day_refs.map((ref) => ({ kind: "day", ref })),
                      ...world.occasion.now_refs.map((ref) => ({ kind: "now", ref })),
                      ...world.occasion.session_refs.map((ref) => ({ kind: "session", ref })),
                      ...world.occasion.run_refs.map((ref) => ({ kind: "run", ref }))]
                      .map((entry) => (
                        <li key={`${entry.kind}:${entry.ref}`} className="techne-instrument">
                          <span className="techne-standing">{entry.kind}</span> <code className="techne-place-ref">{entry.ref}</code>
                        </li>
                      ))}
                  </ul>
                )}
              {world.occasion.timezone_policy_refs.map((ref) => (
                <p key={ref} className="techne-absent">timezone policy <code className="techne-place-ref">{ref}</code></p>
              ))}
              {session?.occasion_ref && <p className="techne-absent">session occasion <code className="techne-place-ref">{session.occasion_ref}</code> — carried unchanged across instruments and cuts</p>}
            </div>

            <div className="techne-place-world-block" aria-label="Producer-bound depth">
              <p className="techne-eyebrow">depth — provider-bound</p>
              <ul className="techne-place-depths">
                {world.depths.map((depth) => (
                  <li key={depth.depth} className="techne-place-depth" data-availability={depth.availability}>
                    <span className="techne-place-depth-name">M{depth.m_prime} · {depth.depth}</span>
                    {depth.availability === "disclosed"
                      ? depth.disclosed.map((item, index) => <p key={index} className="techne-place-depth-detail">{item}</p>)
                      : <p className="techne-place-depth-reason">{depth.reason}</p>}
                    {depth.privacy.map((term) => <p key={term} className="techne-place-privacy" data-privacy="constraint">privacy: {term}</p>)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="techne-place-world-block" aria-label="Privacy constraints">
              <p className="techne-eyebrow">privacy constraints</p>
              {world.privacy_constraints.length === 0
                ? <p className="techne-absent">No privacy constraints are disclosed on this reading.</p>
                : (
                  <ul className="techne-notes">
                    {world.privacy_constraints.map((term) => <li key={term}>{term}</li>)}
                  </ul>
                )}
              <p className="techne-absent">Private situated state is never rendered here — only its disclosed constraint is named.</p>
            </div>

            <div className="techne-place-world-block" aria-label="Technē_4 native actions and crossing">
              <p className="techne-eyebrow">native Actions — routed, never executed</p>
              {world.actions.length === 0
                ? <p className="techne-absent">The reading discloses no native Actions.</p>
                : (
                  <span className="techne-place-rail-group" role="group" aria-label="Route a disclosed native Action">
                    {world.actions.map((action) => (
                      <button key={action.action_ref} type="button" className="techne-open"
                        title={`${action.native_owner} · ${action.authority}${action.summary ? ` — ${action.summary}` : ""}`}
                        onClick={() => routeWorldAction(action.action_ref)}>
                        route {action.action_ref}
                      </button>
                    ))}
                  </span>
                )}
              {receipt && (
                <p className="techne-place-receipt" role="status" data-routed={receipt.routed}>
                  {receipt.routed
                    ? `routed to ${receipt.native_owner} under ${receipt.authority} — effects: ${(receipt.expected_effects ?? []).join("; ") || "none disclosed"}`
                    : `not routed — ${receipt.reason}`}
                </p>
              )}
              {routingError && <p className="techne-absent" role="alert">{routingError}</p>}

              <p className="techne-eyebrow">3:3 crossing — the current lived world</p>
              {crossingAvailable
                ? (
                  <button type="button" className="techne-open"
                    onClick={() => disclosureSession.openInInstrument("expressions")}>
                    Open this world in the Expression reading
                  </button>
                )
                : <p className="techne-absent">3:3 crossing unavailable — {crossingBlockedReason ?? "the Expression reading is not offered by this reading's disclosure"}.</p>}
              <p className="techne-absent">The crossing keeps the same subject, sources and occasion —
                {session?.occasion_ref ? <code className="techne-place-ref"> {session.occasion_ref}</code> : " no occasion ref is disclosed"}
                . Private Nara state does not become portable Expression content by being visualised.</p>
            </div>
          </div>
        </section>
      )}

      <p className="techne-place-status">
        {visible.length} of {state.facets.length} place facets in view · {windowSummary}
        {state.status === "present" && visible.length === 0 ? " — widen the window or clear the filter" : ""}
      </p>
    </div>
  );
}
