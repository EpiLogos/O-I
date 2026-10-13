import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

import type { GeographyEdge } from "@research-canvas/schema";
import type {
  GeoJSONSource,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

import type { WalkStop } from "../scenes/walkAssembly";
import {
  buildGeographyEdgeSource,
  buildPlaceMarkers,
  buildWalkPathSource,
  createOfflineMapStyle,
  GEOGRAPHY_EDGE_COLORS,
  GLOBE,
  PLACE_ROUTE_STYLE,
  skyForProjection,
  type MapSurfaceOptions,
  type MapSurfaceProjection,
  type MapTileSource,
} from "./mapStyle";
import {
  clampPitch,
  defaultPlaceView,
  flightEase,
  isIdle as isStillnessIdle,
  normalizeBearing,
  PITCH_MAX,
  placeMarkerPlan,
  pulseTarget,
  RESET_DURATION_MS,
  STILL,
  type StillnessState,
} from "./placeNavigation";
import type { PlaceRegion } from "./placeLayers";
import type { HierarchyEdgeDraw, PlaceRouteDraw } from "./placeRoutes";
import type { BasemapRenderPlan } from "./basemapLayers";
import type { TerminatorFeature } from "./terminator";
import {
  dragEligibility,
  longPressFires,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
  type PlaceContextEvent,
  type PlaceCoordinate,
} from "./placeAuthoring";

/** The camera as the map reports it. `pitch` and `bearing` are degrees and are
 * absent in records saved before T1; they read as 0. */
/** Consecutive failed tiles, with none loading between them, after which a live basemap source reads as refused. */
const BASEMAP_FAILURE_RUN = 4;

export interface MapViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

/** Optional camera terms for a flight. A pitch request is ignored in flat mode
 * (no error); a bearing applies in both projections. */
export interface MapCameraFlight {
  pitch?: number;
  bearing?: number;
  durationMs?: number;
  easing?: (t: number) => number;
  /** The place this flight travels to: its marker pulses for as long as the flight runs. */
  pulseGraphNodeId?: string;
}

/** An eased return of pitch and bearing in place (no pan, no zoom). */
export interface MapCameraEase {
  pitch?: number;
  bearing?: number;
  durationMs?: number;
  easing?: (t: number) => number;
}

export interface PlaceRenderMarker {
  graphNodeId: string;
  title: string;
  latitude: number;
  longitude: number;
  precision: string;
  entityType: string;
}

export interface ArchetypeExpressionRenderMarker {
  expressionId: string;
  placeGraphNodeId: string;
  latitude: number;
  longitude: number;
  title: string;
}

/**
 * Rendering port for Surface #3. The legacy walk methods remain available to
 * old sequence/story consumers, while Places itself uses `drawPlaces` and is
 * therefore no longer shaped around a single walk.
 */
export interface MapSurfaceRenderer {
  create(
    container: HTMLElement,
    tileSource: MapTileSource,
    options?: MapSurfaceOptions,
  ): Promise<void>;
  drawWalk(walkId: string, stops: WalkStop[]): Promise<void>;
  drawPlaces?(
    places: PlaceRenderMarker[],
    expressions: ArchetypeExpressionRenderMarker[],
  ): Promise<void>;
  drawLanes?(edges: GeographyEdge[]): Promise<void>;
  /** Region polygons: fill and outline at every zoom, the label at the authority's centroid. */
  drawRegions?(regions: PlaceRegion[]): Promise<void>;
  /** Lane-4 T11: the TRAVELLED_TO route as one line with its numbered stops; null draws none. */
  drawRoutes?(route: PlaceRouteDraw | null): Promise<void>;
  /** Lane-4 T12: the drawn LOCATED_IN hierarchy edges as dashed great-circle lines. */
  drawHierarchy?(edges: HierarchyEdgeDraw[]): Promise<void>;
  /** Lane-4 T27: the night side of a STATED subsolar point (drawn, never derived here); null removes it. */
  drawTerminator?(feature: TerminatorFeature | null): Promise<void>;
  /** Lane-4 T4/T5: holds the basemap plan (ground, imagery stack, terrain). Diffed, so a layer that stays keeps its tiles. */
  setBasemapPlan?(plan: BasemapRenderPlan): Promise<void>;
  /** The terrain elevation at a point, read where the terrain layer is loaded; null otherwise. */
  sampleElevation?(latitude: number, longitude: number): number | null;
  /** A basemap source refused by the network, keyed by its registry id, with the refusal's own message. */
  onBasemapError?(handler: (key: string, message: string) => void): void;
  /** Fires when the map has finished drawing and its tiles have settled. */
  onSettled?(handler: () => void): void;
  centerOn(latitude: number, longitude: number, zoom?: number): Promise<void>;
  flyTo?(latitude: number, longitude: number, zoom?: number, camera?: MapCameraFlight): Promise<void>;
  /** Eases pitch and bearing in place: the compass return. */
  easeCamera?(camera: MapCameraEase): Promise<void>;
  /** True when the surface has no eased motion or flight in progress. */
  isIdle?(): boolean;
  fitToPlaces?(places: PlaceRenderMarker[]): Promise<void>;
  setProjection?(projection: MapSurfaceProjection): Promise<void>;
  setStopClickHandler?(handler: (sceneId: string) => void): void;
  setPlaceClickHandler?(handler: (graphNodeId: string) => void): void;
  setPlaceDoubleClickHandler?(handler: (graphNodeId: string) => void): void;
  /** Lane-4 T17: a right-click or a one-finger long-press on the map or on a placed marker. */
  setPlaceContextHandler?(handler: (event: PlaceContextEvent) => void): void;
  /** Lane-4 T19: a draggable marker (approximate or region) was dropped; `from` is where the reading places it. */
  setPlaceDragHandler?(handler: (graphNodeId: string, from: PlaceCoordinate, to: PlaceCoordinate) => void): void;
  /** Lane-4 T19: returns a marker to the coordinate the reading gives it (after a proposal is cancelled or handed on). */
  returnPlaceMarker?(graphNodeId: string): void;
  setLaneClickHandler?(handler: (laneId: string) => void): void;
  onViewChange?(handler: (view: MapViewState) => void): void;
  destroy(): void;
}

/** MapLibre GL implementation. The initial style stays fully offline; a live
 * raster source is installed only after the surface's LiveServicePolicy grants
 * the explicit action. */
export async function createMaplibreRenderer(): Promise<MapSurfaceRenderer> {
  const maplibre = await import("maplibre-gl");
  maplibre.setWorkerUrl(maplibreWorkerUrl);
  let map: InstanceType<typeof maplibre.Map> | null = null;
  let stopClickHandler: ((sceneId: string) => void) | null = null;
  let placeClickHandler: ((graphNodeId: string) => void) | null = null;
  let placeDoubleClickHandler: ((graphNodeId: string) => void) | null = null;
  let laneClickHandler: ((laneId: string) => void) | null = null;
  let viewChangeHandler: ((view: MapViewState) => void) | null = null;
  let htmlMarkers: Array<{ remove(): void }> = [];
  // Region labels are their own markers: a redraw of the place points must not erase them.
  let regionLabelMarkers: Array<{ remove(): void }> = [];
  // Route stops are their own markers, so a redraw of the place points never erases them.
  let routeStopMarkers: Array<{ remove(): void }> = [];
  let projection: MapSurfaceProjection = "globe";
  // The globe's own tilt, kept while the flat projection holds the camera top-down.
  let globeTilt: number | null = null;
  // Lane-4 T29: the only motion this surface owns is an eased flight or return the
  // reader asked for. Each one carries a clock and ends by it, so nothing outlives
  // its motion; the marker pulse exists only while its place's flight runs.
  let motion: StillnessState = STILL;
  let motionToken = 0;
  let motionTimer: ReturnType<typeof setTimeout> | null = null;
  let pulseAnimation: Animation | null = null;
  let placeElements = new Map<string, HTMLElement>();
  // Lane-4 T4/T5: the basemap sources this renderer holds, by MapLibre source id.
  let basemapHeld = new Map<string, { key: string; layerId: string | null }>();
  // Consecutive tile errors per basemap source since its last loaded tile (lane-4 T4: one bad tile is not a refusal).
  const basemapErrorRuns = new Map<string, number>();
  let basemapErrorHandler: ((key: string, message: string) => void) | null = null;
  let settledHandler: (() => void) | null = null;
  // Lane-4 T17/T19: the menu and drag handlers, each place marker's own maplibre marker with the
  // coordinate the reading gives it, and the moment a drag ended (so its click is not a click).
  let placeContextHandler: ((event: PlaceContextEvent) => void) | null = null;
  let placeDragHandler: ((graphNodeId: string, from: PlaceCoordinate, to: PlaceCoordinate) => void) | null = null;
  let placeMarkerHomes = new Map<string, { marker: InstanceType<typeof maplibre.Marker>; latitude: number; longitude: number }>();
  let lastPlaceDragEnd = 0;
  // A long-press that opened the menu is followed by a click on touch; that click is swallowed.
  let swallowClickUntil = 0;
  interface PressState { timer: ReturnType<typeof setTimeout>; x: number; y: number; moved: number; target: EventTarget | null }
  let press: PressState | null = null;

  function emitViewChange(): void {
    if (!map || !viewChangeHandler) return;
    const center = map.getCenter();
    viewChangeHandler({
      latitude: center.lat,
      longitude: center.lng,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    });
  }

  function clearHtmlMarkers(): void {
    for (const marker of htmlMarkers) marker.remove();
    htmlMarkers = [];
    placeElements = new Map();
    placeMarkerHomes = new Map();
    pulseAnimation = null;
  }

  function clearRegionLabels(): void {
    for (const marker of regionLabelMarkers) marker.remove();
    regionLabelMarkers = [];
  }

  function clearRouteStops(): void {
    for (const marker of routeStopMarkers) marker.remove();
    routeStopMarkers = [];
  }

  function stopPulse(): void {
    pulseAnimation?.cancel();
    pulseAnimation = null;
  }

  // A pulse is a Web Animation on the one marker a flight travels to. It is
  // cancelled the moment that flight ends; no timer or frame loop drives it.
  function startPulse(): void {
    stopPulse();
    const target = pulseTarget(motion);
    const element = target ? placeElements.get(target) : undefined;
    if (!element || typeof element.animate !== "function") return;
    pulseAnimation = element.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(1.7)", opacity: 0.45 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 1100, iterations: Infinity, easing: "ease-in-out" },
    );
  }

  function endMotion(): void {
    motion = STILL;
    stopPulse();
  }

  // Begins a motion and returns its token. Its clock ends the motion after its
  // duration, so a motion always finishes even if the map reports no moveend.
  function beginMotion(next: StillnessState, durationMs: number): number {
    const token = ++motionToken;
    if (motionTimer !== null) clearTimeout(motionTimer);
    motion = next;
    startPulse();
    motionTimer = setTimeout(() => {
      motionTimer = null;
      if (token === motionToken) endMotion();
    }, durationMs + 250);
    return token;
  }

  return {
    async create(el, tileSource, options) {
      projection = options?.projection ?? "globe";
      const home = defaultPlaceView();
      map = new maplibre.Map({
        container: el,
        style: createOfflineMapStyle(tileSource, { projection }) as StyleSpecification,
        attributionControl: { compact: false },
        // Keep renderer bootstrap identical to PsychogeographicMap's declared
        // default state (the same defaultPlaceView). MapLibre otherwise boots at
        // 0,0 and can publish a late moveend after the surface has subscribed,
        // persisting a camera the application never selected.
        center: [home.longitude, home.latitude],
        zoom: home.zoom,
      });
      map.on("moveend", emitViewChange);
      // Full navigation: right-drag or Ctrl-drag rotates and tilts the globe;
      // two fingers rotate (touchZoomRotate) and tilt (touchPitch).
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
      map.on("click", "psychogeographic-marker-layer", (event) => {
        const feature = event.features?.[0];
        const sceneId = feature?.properties?.id as string | undefined;
        if (sceneId && stopClickHandler) stopClickHandler(sceneId);
      });
      map.on("click", "geography-edges-layer", (event) => {
        const feature = event.features?.[0];
        const laneId = feature?.properties?.id as string | undefined;
        if (laneId && laneClickHandler) laneClickHandler(laneId);
      });
      // A region is selected through its own place, as a point marker is.
      map.on("click", "places-regions-fill", (event) => {
        const feature = event.features?.[0];
        const placeRef = feature?.properties?.id as string | undefined;
        if (placeRef && placeClickHandler) placeClickHandler(placeRef);
      });
      // Lane-4 T4/T5: a basemap source the network refuses reports the refusal's own message.
      // A tile request the map itself cancelled (a pan or a zoom) is not a refusal.
      map.on("error", (raised) => {
        const event = raised as unknown as { sourceId?: string; error?: unknown };
        if (!event.sourceId || !basemapHeld.has(event.sourceId)) return;
        const cause = event.error as { name?: string; message?: string } | undefined;
        if (cause?.name === "AbortError") return;
        const held = basemapHeld.get(event.sourceId);
        // One failed tile (a 429, a 503) is not a refused source: a source fails after BASEMAP_FAILURE_RUN consecutive tile
        // errors with no tile loaded between them, or on an error that names no tile (the source itself).
        const tiled = (raised as unknown as { tile?: unknown }).tile !== undefined;
        const run = (basemapErrorRuns.get(event.sourceId) ?? 0) + 1;
        basemapErrorRuns.set(event.sourceId, run);
        if (tiled && run < BASEMAP_FAILURE_RUN) return;
        if (held && basemapErrorHandler) basemapErrorHandler(held.key, cause?.message ?? String(event.error));
      });
      map.on("sourcedata", (event) => {
        const loaded = event as unknown as { sourceId?: string; tile?: unknown };
        if (loaded.sourceId && loaded.tile !== undefined) basemapErrorRuns.delete(loaded.sourceId);
      });
      map.on("idle", () => settledHandler?.());
      // Lane-4 T17: the menu a right-click or a one-finger long-press asks for. The point is
      // unprojected from the container, so an empty-map menu carries the coordinate it was asked at.
      const emitPlaceContext = (clientX: number, clientY: number, target: EventTarget | null): void => {
        if (!map || !placeContextHandler) return;
        const rect = map.getContainer().getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const at = map.unproject([x, y]);
        const markerElement = target instanceof Element ? target.closest<HTMLElement>(".places-globe-marker") : null;
        placeContextHandler({ graphNodeId: markerElement?.dataset.graphNodeId ?? null, latitude: at.lat, longitude: at.lng, x, y });
      };
      el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        emitPlaceContext(event.clientX, event.clientY, event.target);
      });
      const cancelPress = (): void => {
        if (press) clearTimeout(press.timer);
        press = null;
      };
      el.addEventListener("touchstart", (event) => {
        cancelPress();
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        const started = { x: touch.clientX, y: touch.clientY, moved: 0, target: event.target };
        press = {
          ...started,
          timer: setTimeout(() => {
            const held = press;
            press = null;
            // The timer is the hold itself; the only test left is that the touch did not travel.
            if (!held || !longPressFires(LONG_PRESS_MS, held.moved)) return;
            swallowClickUntil = performance.now() + 400;
            emitPlaceContext(held.x, held.y, held.target);
          }, LONG_PRESS_MS),
        };
      }, { passive: true });
      el.addEventListener("touchmove", (event) => {
        if (!press) return;
        if (event.touches.length !== 1) { cancelPress(); return; }
        const touch = event.touches[0];
        press.moved = Math.max(press.moved, Math.hypot(touch.clientX - press.x, touch.clientY - press.y));
        if (press.moved > LONG_PRESS_SLOP_PX) cancelPress();
      }, { passive: true });
      el.addEventListener("touchend", cancelPress, { passive: true });
      el.addEventListener("touchcancel", cancelPress, { passive: true });
      await waitForStyleLoad(map);
      if (projection === "globe") {
        map.setSky(skyForProjection("globe") as never);
      }
      emitViewChange();
    },
    async drawWalk(walkId, stops) {
      if (!map) throw new Error("map renderer is not initialized");
      const markers = buildPlaceMarkers(stops);
      const path = buildWalkPathSource(walkId, stops);
      addGeoJsonSource(map, "psychogeographic-markers", {
        type: "FeatureCollection",
        features: markers,
      });
      addGeoJsonSource(map, "psychogeographic-walk", path);
      ensureLayer(map, {
        id: "psychogeographic-walk-layer",
        type: "line",
        source: "psychogeographic-walk",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": GLOBE.arc, "line-width": 3 },
      });
      ensureLayer(map, {
        id: "psychogeographic-marker-layer",
        type: "circle",
        source: "psychogeographic-markers",
        paint: {
          "circle-radius": 7,
          "circle-color": GLOBE.marker,
          "circle-stroke-color": "#17171d",
          "circle-stroke-width": 2,
        },
      });
    },
    async drawPlaces(places, expressions) {
      if (!map) throw new Error("map renderer is not initialized");
      clearHtmlMarkers();

      for (const place of places) {
        // Precision is data: the kind comes from precisionMarker through
        // placeMarkerPlan. A no-coordinate place has no plan and is never drawn,
        // so it cannot appear at (0,0) or anywhere else on the globe.
        const plan = placeMarkerPlan({
          precision: place.precision,
          latitude: place.latitude,
          longitude: place.longitude,
        });
        if (!plan) continue;
        const { style } = plan;

        // A zero-size anchor sits exactly on the coordinate; the disc and the
        // uncertainty note are positioned from it, so the note never moves the fix.
        const anchor = document.createElement("div");
        anchor.className = "places-globe-marker-anchor";
        Object.assign(anchor.style, { position: "relative", width: "0", height: "0" });

        const element = document.createElement("button");
        element.type = "button";
        element.className = "places-globe-marker";
        element.dataset.testid = `globe-marker-${place.graphNodeId}`;
        element.dataset.precision = place.precision;
        element.dataset.markerKind = style.kind;
        element.dataset.entityType = place.entityType;
        element.dataset.graphNodeId = place.graphNodeId;
        // Lane-4 T19: only an approximate or region point drags; an exact fix shows why in its title.
        const eligibility = dragEligibility(place.precision, "point");
        const base = style.uncertainty ? `${place.title} — ${style.note}` : place.title;
        element.dataset.draggable = eligibility.ok ? "true" : "false";
        element.title = eligibility.ok ? `${base} — drag to propose a new position` : `${base} — ${eligibility.reason}`;
        element.setAttribute("aria-label", `Open ${place.title}`);
        Object.assign(element.style, {
          position: "absolute",
          left: `${-style.diameterPx / 2}px`,
          top: `${-style.diameterPx / 2}px`,
          width: `${style.diameterPx}px`,
          height: `${style.diameterPx}px`,
          borderRadius: "50%",
          border: style.border,
          background: style.background,
          boxShadow: style.boxShadow,
          cursor: eligibility.ok ? "grab" : place.precision === "exact" ? "not-allowed" : "pointer",
          padding: "0",
        });
        anchor.append(element);
        placeElements.set(place.graphNodeId, element);

        if (style.uncertainty) {
          const note = document.createElement("span");
          note.className = "places-precision-note";
          note.dataset.testid = `globe-marker-note-${place.graphNodeId}`;
          note.textContent = style.note;
          Object.assign(note.style, {
            position: "absolute",
            left: `${style.diameterPx / 2 + 6}px`,
            top: "-7px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            fontSize: "10px",
            lineHeight: "14px",
            color: "#c9b68a",
            textShadow: "0 1px 2px rgba(0,0,0,.85)",
          });
          anchor.append(note);
        }

        element.addEventListener("click", (event) => {
          event.stopPropagation();
          // A drop is not a selection, and the click a long-press leaves behind is not one either.
          const now = performance.now();
          if (now - lastPlaceDragEnd < 300 || now < swallowClickUntil) return;
          placeClickHandler?.(place.graphNodeId);
        });
        element.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
          placeDoubleClickHandler?.(place.graphNodeId);
        });
        // Lane-4 T19: a draggable marker moves under the pointer and reports where it was dropped.
        // The marker stays where it was dropped until the proposal is applied or cancelled; the
        // reading (and the marker's home) is what it returns to.
        const marker = new maplibre.Marker({ element: anchor, anchor: "center", draggable: eligibility.ok })
          .setLngLat([plan.longitude, plan.latitude])
          .addTo(map);
        if (eligibility.ok) {
          marker.on("dragstart", () => {
            element.style.cursor = "grabbing";
          });
          marker.on("dragend", () => {
            element.style.cursor = "grab";
            lastPlaceDragEnd = performance.now();
            const dropped = marker.getLngLat();
            placeDragHandler?.(
              place.graphNodeId,
              { latitude: plan.latitude, longitude: plan.longitude },
              { latitude: dropped.lat, longitude: dropped.lng },
            );
          });
        }
        htmlMarkers.push(marker);
        placeMarkerHomes.set(place.graphNodeId, { marker, latitude: plan.latitude, longitude: plan.longitude });
      }
      // Markers are rebuilt on every draw; a flight still travelling re-attaches its pulse.
      startPulse();

      for (const expression of expressions) {
        const element = document.createElement("span");
        element.className = "places-archetype-marker";
        element.dataset.testid = `globe-archetype-marker-${expression.expressionId}`;
        element.title = expression.title;
        Object.assign(element.style, {
          display: "block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#b892d8",
          boxShadow: "0 0 0 4px rgba(184,146,216,.15), 0 0 12px rgba(184,146,216,.65)",
          pointerEvents: "none",
          transform: "translate(10px, -10px)",
        });
        htmlMarkers.push(
          new maplibre.Marker({ element, anchor: "center" })
            .setLngLat([expression.longitude, expression.latitude])
            .addTo(map),
        );
      }
    },
    async drawLanes(edges) {
      if (!map) throw new Error("map renderer is not initialized");
      addGeoJsonSource(map, "geography-edges", buildGeographyEdgeSource(edges));
      ensureLayer(map, {
        id: "geography-edges-layer",
        type: "line",
        source: "geography-edges",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "match",
            ["get", "mode"],
            "flight",
            GEOGRAPHY_EDGE_COLORS.flight,
            "shipping",
            GEOGRAPHY_EDGE_COLORS.shipping,
            "overland",
            GEOGRAPHY_EDGE_COLORS.overland,
            "inland_water",
            GEOGRAPHY_EDGE_COLORS.inland_water,
            GLOBE.arc,
          ],
          "line-width": 2,
          "line-opacity": 0.85,
        },
      });
    },
    async drawRegions(regions) {
      if (!map) throw new Error("map renderer is not initialized");
      // A region is its polygon, filled and outlined. The outline width is in pixels,
      // so it holds at every zoom; the label sits at the authority's centroid.
      addGeoJsonSource(map, "places-regions", {
        type: "FeatureCollection",
        features: regions.map((region) => ({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: region.rings },
          properties: {
            id: region.place_ref,
            color: region.colour,
            precision: region.precision,
          },
        })),
      });
      ensureLayer(map, {
        id: "places-regions-fill",
        type: "fill",
        source: "places-regions",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 },
      });
      ensureLayer(map, {
        id: "places-regions-outline",
        type: "line",
        source: "places-regions",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.9 },
      });
      clearRegionLabels();
      for (const region of regions) {
        const element = document.createElement("span");
        element.className = "places-region-label";
        element.dataset.testid = `globe-region-label-${region.place_ref}`;
        element.dataset.precision = region.precision;
        element.title = region.note;
        element.textContent = `${region.label ?? region.place_ref} · ${region.precision}`;
        Object.assign(element.style, {
          display: "block",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          fontSize: "11px",
          lineHeight: "14px",
          color: "#c9b68a",
          textShadow: "0 1px 2px rgba(0,0,0,.85)",
        });
        regionLabelMarkers.push(
          new maplibre.Marker({ element, anchor: "center" })
            .setLngLat(region.anchor)
            .addTo(map),
        );
      }
    },
    async drawRoutes(route) {
      if (!map) throw new Error("map renderer is not initialized");
      // The route is one line in the reading's own stop order; a null route draws nothing.
      addGeoJsonSource(map, "places-routes", {
        type: "FeatureCollection",
        features: route
          ? [{ type: "Feature", geometry: { type: "LineString", coordinates: route.path }, properties: { id: "route" } }]
          : [],
      });
      ensureLayer(map, {
        id: "places-routes-layer",
        type: "line",
        source: "places-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": PLACE_ROUTE_STYLE.route, "line-width": 2.5, "line-opacity": 0.9 },
      });
      clearRouteStops();
      if (!route) return;
      // Each stop is a numbered button. Its click is the place's own click (select, detail, fly).
      for (const stop of route.stops) {
        const anchor = document.createElement("div");
        anchor.className = "places-route-stop-anchor";
        Object.assign(anchor.style, { position: "relative", width: "0", height: "0" });

        const element = document.createElement("button");
        element.type = "button";
        element.className = "places-route-stop";
        element.dataset.testid = `globe-route-stop-${stop.place_ref}`;
        element.dataset.stop = String(stop.number);
        element.textContent = String(stop.number);
        const label = stop.label ?? stop.place_ref;
        element.title = stop.ordering_bound
          ? `${stop.number}. ${label} · from ${stop.ordering_bound}`
          : `${stop.number}. ${label}`;
        element.setAttribute("aria-label", `Route stop ${stop.number}: ${label}`);
        Object.assign(element.style, {
          position: "absolute",
          left: "10px",
          top: "-22px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          border: `1px solid ${PLACE_ROUTE_STYLE.stopText}`,
          background: PLACE_ROUTE_STYLE.stop,
          color: PLACE_ROUTE_STYLE.stopText,
          font: "600 10px/16px sans-serif",
          textAlign: "center",
          cursor: "pointer",
          padding: "0",
        });
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          placeClickHandler?.(stop.place_ref);
        });
        anchor.append(element);
        routeStopMarkers.push(
          new maplibre.Marker({ element: anchor, anchor: "center" })
            .setLngLat(stop.lonLat)
            .addTo(map),
        );
      }
    },
    async drawTerminator(feature) {
      if (!map) throw new Error("map renderer is not initialized");
      const m = map;
      if (feature === null) {
        for (const id of ["places-terminator-edge", "places-terminator-fill"]) {
          if (m.getLayer(id)) m.removeLayer(id);
        }
        if (m.getSource("places-terminator")) m.removeSource("places-terminator");
        return;
      }
      addGeoJsonSource(m, "places-terminator", feature);
      // The night side sits above the basemap and beneath the place overlays, so markers and routes stay legible through it.
      const beneath = TERMINATOR_ANCHORS.find((id) => m.getLayer(id));
      if (!m.getLayer("places-terminator-fill")) {
        m.addLayer({
          id: "places-terminator-fill",
          type: "fill",
          source: "places-terminator",
          paint: { "fill-color": TERMINATOR_STYLE.night, "fill-opacity": TERMINATOR_STYLE.nightOpacity },
        } as never, beneath);
      }
      if (!m.getLayer("places-terminator-edge")) {
        m.addLayer({
          id: "places-terminator-edge",
          type: "line",
          source: "places-terminator",
          paint: { "line-color": TERMINATOR_STYLE.edge, "line-width": 1, "line-dasharray": [3, 2], "line-opacity": 0.7 },
        } as never, beneath);
      }
    },
    async drawHierarchy(edges) {
      if (!map) throw new Error("map renderer is not initialized");
      addGeoJsonSource(map, "places-hierarchy", {
        type: "FeatureCollection",
        features: edges.map((edge) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: edge.path },
          properties: { from: edge.from_ref, to: edge.to_ref, relation: edge.relation },
        })),
      });
      ensureLayer(map, {
        id: "places-hierarchy-layer",
        type: "line",
        source: "places-hierarchy",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": PLACE_ROUTE_STYLE.hierarchy,
          "line-width": 1.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        },
      });
    },
    async setBasemapPlan(plan) {
      if (!map) throw new Error("map renderer is not initialized");
      const m = map;
      // Terrain reads its elevation source, so it comes off before any source is removed.
      if (m.getTerrain() && (plan.terrain === null || m.getTerrain()?.source !== plan.terrain.sourceId)) {
        m.setTerrain(null);
      }
      const wanted = new Set([
        ...plan.rasters.map((draw) => draw.sourceId),
        ...(plan.terrain ? [plan.terrain.sourceId] : []),
      ]);
      for (const [sourceId, held] of [...basemapHeld]) {
        if (wanted.has(sourceId)) continue;
        if (held.layerId && m.getLayer(held.layerId)) m.removeLayer(held.layerId);
        if (m.getSource(sourceId)) m.removeSource(sourceId);
        basemapHeld.delete(sourceId);
        basemapErrorRuns.delete(sourceId);
      }
      // The offline ground is the bundled pack's own layer: its visibility and opacity, nothing else.
      const ground = m.getLayer("offline-base");
      if (ground) {
        m.setLayoutProperty("offline-base", "visibility", plan.ground.visible ? "visible" : "none");
        if (ground.type === "circle") m.setPaintProperty("offline-base", "circle-opacity", 0.9 * plan.ground.opacity);
        if (ground.type === "raster") m.setPaintProperty("offline-base", "raster-opacity", plan.ground.opacity);
      }
      // Imagery stacks above the ground and below every overlay, in registry order.
      const anchor = firstOverlayLayerId(m);
      for (let index = 0; index < plan.rasters.length; index += 1) {
        const draw = plan.rasters[index];
        if (m.getSource(draw.sourceId)) {
          if (m.getLayer(draw.layerId)) m.setPaintProperty(draw.layerId, "raster-opacity", draw.opacity);
          continue;
        }
        m.addSource(draw.sourceId, {
          type: "raster",
          tiles: draw.tiles,
          tileSize: draw.tileSize,
          maxzoom: draw.maxZoom,
          attribution: draw.attribution,
        } as SourceSpecification);
        // A new layer goes beneath the next imagery above it that is already on the map. A layer that cannot be added takes
        // its source back off, so the next apply starts clean instead of finding an orphaned source and drawing nothing.
        const above = plan.rasters.slice(index + 1).map((next) => next.layerId).find((id) => m.getLayer(id));
        try {
          m.addLayer(
            { id: draw.layerId, type: "raster", source: draw.sourceId, paint: { "raster-opacity": draw.opacity } } as never,
            above ?? anchor,
          );
        } catch (cause) {
          if (m.getSource(draw.sourceId)) m.removeSource(draw.sourceId);
          throw cause;
        }
        basemapHeld.set(draw.sourceId, { key: draw.key, layerId: draw.layerId });
      }
      if (plan.terrain) {
        const terrain = plan.terrain;
        if (!m.getSource(terrain.sourceId)) {
          m.addSource(terrain.sourceId, {
            type: "raster-dem",
            tiles: terrain.tiles,
            tileSize: terrain.tileSize,
            maxzoom: terrain.maxZoom,
            encoding: terrain.encoding,
            attribution: terrain.attribution,
          } as never);
          basemapHeld.set(terrain.sourceId, { key: terrain.key, layerId: null });
        }
        if (m.getTerrain()?.source !== terrain.sourceId) m.setTerrain({ source: terrain.sourceId, exaggeration: 1 });
      }
    },
    sampleElevation(latitude, longitude) {
      if (!map || !map.getTerrain()) return null;
      return map.queryTerrainElevation([longitude, latitude]);
    },
    onBasemapError(handler) {
      basemapErrorHandler = handler;
    },
    onSettled(handler) {
      settledHandler = handler;
    },
    async centerOn(latitude, longitude, zoom) {
      if (!map) return;
      map.jumpTo({ center: [longitude, latitude], zoom: zoom ?? 5 });
    },
    async flyTo(latitude, longitude, zoom, camera) {
      if (!map) return;
      const durationMs = camera?.durationMs ?? 900;
      beginMotion({ flight: { graphNodeId: camera?.pulseGraphNodeId ?? null }, easing: true }, durationMs);
      map.flyTo({
        center: [longitude, latitude],
        zoom: zoom ?? 4,
        duration: durationMs,
        ...(camera?.easing ? { easing: camera.easing } : {}),
        ...(camera?.bearing !== undefined ? { bearing: normalizeBearing(camera.bearing) } : {}),
        // Flat is top-down: a pitch request is ignored there, never an error.
        ...(projection === "globe" && camera?.pitch !== undefined
          ? { pitch: clampPitch(camera.pitch) }
          : {}),
      });
    },
    async easeCamera(camera) {
      if (!map) return;
      const durationMs = camera.durationMs ?? RESET_DURATION_MS;
      beginMotion({ flight: null, easing: true }, durationMs);
      map.easeTo({
        duration: durationMs,
        easing: camera.easing ?? flightEase,
        ...(camera.bearing !== undefined ? { bearing: normalizeBearing(camera.bearing) } : {}),
        ...(camera.pitch !== undefined ? { pitch: clampPitch(camera.pitch) } : {}),
      });
    },
    isIdle() {
      return isStillnessIdle(motion);
    },
    async fitToPlaces(places) {
      if (!map || places.length === 0) return;
      if (places.length === 1) {
        map.flyTo({
          center: [places[0].longitude, places[0].latitude],
          zoom: 5,
          duration: 700,
        });
        return;
      }
      const bounds = new maplibre.LngLatBounds();
      for (const place of places) bounds.extend([place.longitude, place.latitude]);
      map.fitBounds(bounds, { padding: 72, maxZoom: 6, duration: 700 });
    },
    async setProjection(next) {
      if (!map) return;
      if (next === "flat") {
        // Flat holds the camera top-down: the ceiling makes every pitch source
        // (gesture, flyTo, restore) read as 0. The globe's tilt is kept for return.
        if (projection === "globe") globeTilt = map.getPitch();
        map.setMaxPitch(0);
        map.setPitch(0);
      }
      projection = next;
      map.setProjection({ type: next === "globe" ? "globe" : "mercator" });
      // The limb belongs to the globe only; flat carries the same sky with no limb.
      map.setSky(skyForProjection(next) as never);
      if (next === "globe") {
        map.setMaxPitch(PITCH_MAX);
        if (globeTilt !== null) {
          map.setPitch(globeTilt);
          globeTilt = null;
        }
      }
      const globeOnly = next === "globe";
      if (map.getLayer("graticule-lines")) {
        map.setLayoutProperty("graticule-lines", "visibility", globeOnly ? "visible" : "none");
      }
      if (map.getLayer("ocean-background")) {
        map.setLayoutProperty("ocean-background", "visibility", globeOnly ? "visible" : "none");
      }
    },
    setStopClickHandler(handler) {
      stopClickHandler = handler;
    },
    setPlaceClickHandler(handler) {
      placeClickHandler = handler;
    },
    setPlaceDoubleClickHandler(handler) {
      placeDoubleClickHandler = handler;
    },
    setPlaceContextHandler(handler) {
      placeContextHandler = handler;
    },
    setPlaceDragHandler(handler) {
      placeDragHandler = handler;
    },
    returnPlaceMarker(graphNodeId) {
      const home = placeMarkerHomes.get(graphNodeId);
      if (!home) return;
      home.marker.setLngLat([home.longitude, home.latitude]);
    },
    setLaneClickHandler(handler) {
      laneClickHandler = handler;
    },
    onViewChange(handler) {
      viewChangeHandler = handler;
    },
    destroy() {
      if (motionTimer !== null) clearTimeout(motionTimer);
      motionTimer = null;
      motion = STILL;
      clearHtmlMarkers();
      clearRegionLabels();
      clearRouteStops();
      map?.remove();
      map = null;
      stopClickHandler = null;
      placeClickHandler = null;
      placeDoubleClickHandler = null;
      laneClickHandler = null;
      viewChangeHandler = null;
      basemapHeld = new Map();
      basemapErrorHandler = null;
      settledHandler = null;
    },
  };
}

const BASE_LAYER_IDS = new Set(["ocean-background", "graticule-lines", "offline-base"]);

/** Lane-4 T27: the night shading's paint. One tuned set; the stated reading is the only source of its geometry. */
const TERMINATOR_STYLE = { night: "#050812", nightOpacity: 0.34, edge: "#c9b68a" } as const;

/** The place overlays the night shading draws beneath, first found wins. */
const TERMINATOR_ANCHORS = [
  "places-regions-fill",
  "geography-edges-layer",
  "places-hierarchy-layer",
  "places-routes-layer",
  "psychogeographic-walk-layer",
  "psychogeographic-marker-layer",
];

/** The first layer above the offline ground that is not a basemap layer: the overlays begin here. */
function firstOverlayLayerId(map: InstanceType<typeof import("maplibre-gl").Map>): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((layer) => !BASE_LAYER_IDS.has(layer.id) && !layer.id.startsWith("basemap-"))?.id;
}

function addGeoJsonSource(
  map: InstanceType<typeof import("maplibre-gl").Map>,
  id: string,
  data: unknown,
): void {
  if (map.getSource(id)) {
    (map.getSource(id) as unknown as GeoJSONSource).setData(data as never);
  } else {
    map.addSource(id, {
      type: "geojson",
      data: data as never,
    } as SourceSpecification);
  }
}

function ensureLayer(
  map: InstanceType<typeof import("maplibre-gl").Map>,
  layer: Record<string, unknown>,
): void {
  const id = layer.id as string;
  if (map.getLayer(id)) return;
  map.addLayer(layer as never);
}

function waitForStyleLoad(
  map: InstanceType<typeof import("maplibre-gl").Map>,
): Promise<void> {
  if (map.isStyleLoaded()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("map style load timed out (is the maplibre-gl worker being served?)")),
      15_000,
    );
    map.once("load", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}