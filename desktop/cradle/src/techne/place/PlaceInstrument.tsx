/**
 * The Place instrument surface (L5 Technē T4) — the general spatial aperture
 * over `TechnePlaceFacet` readings. Map, globe and street are presentations
 * of the SAME reading data (`modes.ts`), switched by local presentation
 * state; nothing here is a spatial store. Rendered schematically in SVG —
 * lat/lon into the view, no tiles, no basemap dependency.
 *
 * Laws carried here:
 *   - camera, zoom, mode and the time filter are LOCAL presentation state;
 *     the time filter seeds from the shared session `time_window` when the
 *     session carries one;
 *   - precision is data: the four renderings (solid / halo / outline /
 *     no-coordinate) stay visually distinct and uncertainty is never
 *     upgraded to look nicer;
 *   - clicking a place sets the DisclosureSession selection through
 *     `selectionForPlace` (focus_refs = [place_ref], refs verbatim) and
 *     offers cross-open strictly from the reading's disclosure;
 *   - absent facets are data: an empty honest state, never an error.
 */
import { useEffect, useId, useMemo, useState } from "react";
import "@epilogos/oi-design-system/techne.css";
import "./place.css";
import { disclosureSession } from "../session";
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
import { placesInWindow, validInWindow, type TimeWindow } from "./filter";
import { crossOpenTargets, selectionForPlace } from "./register";

interface MarkerShape {
  place_ref: string;
  precision: string;
  marker: PlaceMarker;
  label: string | null;
  position: { x: number; y: number } | null;
  rings: Array<Array<{ x: number; y: number }>> | null;
}

const VIEW = { width: 720, height: 360 };

function PlaceMarkerView({ place, selected, onSelect }: { place: MarkerShape; selected: boolean; onSelect: (placeRef: string) => void }) {
  const title = `${place.label ?? place.place_ref} — ${place.marker.note}`;
  const state = { "data-precision": place.precision, "data-selected": selected };
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

function DetailRows({ detail }: { detail: StreetModel }) {
  if (!detail.place) {
    return <p className="techne-absent">No place stands in this view — widen the window or clear the filter.</p>;
  }
  const validity = `${detail.valid_from ?? "open"} → ${detail.valid_to ?? "open"}`;
  const geometry = detail.geometry.kind === "point"
    ? `point · ${detail.geometry.lon}, ${detail.geometry.lat}`
    : detail.geometry.kind === "polygon"
      ? `polygon · ${detail.geometry.vertices} vertices`
      : "no coordinate disclosed";
  return (
    <div className="techne-place-detail-body">
      <code className="techne-place-ref" title="Place ref">{detail.place_ref}</code>
      <dl className="techne-place-rows">
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
        <dt>geometry</dt>
        <dd>{geometry}</dd>
        <dt>validity</dt>
        <dd>{validity}</dd>
        <dt>hierarchy</dt>
        <dd>
          {detail.hierarchy.length === 0 ? "(none disclosed)" : detail.hierarchy.map((row, index) => (
            <span key={index} className="techne-place-name-row">
              {row.relation} · {row.parent_name ?? row.place_ref}{" "}
              <span className="techne-place-validity">{row.valid_from ?? "open"} → {row.valid_to ?? "open"}</span>
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
  const model = renderForMode(mode, visible, { camera, window: timeWindow, selectedRef });
  const detail = renderStreetModel(visible, { window: timeWindow, selectedRef });
  const targets = crossOpenTargets(reading);

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

  return (
    <div className="oi-techne techne-place">
      <div className="techne-place-rail" role="toolbar" aria-label="Place presentations, camera and time filter">
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
        <span className="oi-techne-divider" />
        <span className="techne-place-rail-group" role="group" aria-label="Open this selection in another instrument">
          {targets.map((target) => (
            <button key={target.instrument} type="button" className="techne-open"
              onClick={() => disclosureSession.openInInstrument(target.instrument)}>
              Open in {target.instrument}
            </button>
          ))}
        </span>
      </div>

      {state.status === "empty" && <p className="techne-absent" role="note">{state.reason}</p>}

      <div className="techne-place-stage">
        {projection && (
          <svg
            className="techne-place-map"
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Place map — ${visible.length} places in view`}
          >
            {graticule.length > 0 && <g className="techne-place-graticule">{graticule}</g>}
            {mapEdges.map((edge, index) => (
              <line key={index} className="techne-place-edge" x1={edge.from!.x} y1={edge.from!.y} x2={edge.to!.x} y2={edge.to!.y} />
            ))}
            {model.mode === "map" && model.projection.places.map((place) => (
              <PlaceMarkerView key={place.place_ref} place={place} selected={selectedRef === place.place_ref} onSelect={selectPlace} />
            ))}
          </svg>
        )}

        {globe && (
          <svg
            className="techne-place-map"
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Place globe — ${globe.places.filter((place) => place.position).length} places on the front hemisphere`}
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
              {globe.places.map((place) => (
                <PlaceMarkerView key={place.place_ref} place={place} selected={selectedRef === place.place_ref} onSelect={selectPlace} />
              ))}
            </g>
          </svg>
        )}

        {model.mode === "street" && (
          <section className="techne-place-detail oi-techne-panel oi-techne-panel--opaque techne-place-detail--main" aria-label="Place detail">
            <h3 className="techne-place-detail-title">street — single place</h3>
            <DetailRows detail={detail} />
          </section>
        )}

        {model.mode !== "street" && selectedRef && detail.place && (
          <aside className="techne-place-detail oi-techne-panel oi-techne-panel--opaque" aria-label="Place detail">
            <h3 className="techne-place-detail-title">place detail</h3>
            <DetailRows detail={detail} />
          </aside>
        )}
      </div>

      <p className="techne-place-status">
        {visible.length} of {state.facets.length} place facets in view · {windowSummary}
        {state.status === "present" && visible.length === 0 ? " — widen the window or clear the filter" : ""}
      </p>
    </div>
  );
}
