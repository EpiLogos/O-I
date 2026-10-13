import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import type { ArchetypalExpression, GeographyEdge, GraphNodeContract } from "@research-canvas/schema";
import type { LocatedGraphNode, PlacesRepository } from "@research-canvas/domain";
import type { LiveServicePolicy } from "@research-canvas/geography";

import type { TechnePlaceFacet } from "../../../../../../../src/techne/contract";
import { OPEN_PLACE_FILTER, type PlaceFilterState } from "../../../../../../field-studies-journeys/src/placeReading";
import { standingLabel, type StandingDrawing } from "../timeline/standingStyle";

import { LocationPanel, pointForPlace } from "./LocationPanel";
import { attributionReadout, imageryReadout, liveTileDisclosure } from "./disclosure";
import {
  admittedFacets,
  layerVisible,
  placeLayers,
  placeRefsHidden,
  placeRegions,
  polygonPlaceRefs,
  toggleLayer,
  type PlaceLayer,
  type PlaceRegion,
} from "./placeLayers";
import { placeHierarchy, placeRouteForMap, type HierarchyEdgeDraw, type PlaceRouteDraw } from "./placeRoutes";
import type { MapTileSource } from "./mapStyle";
import {
  defaultPlaceView,
  flightEase,
  northResetView,
  planPlaceFlight,
  placeMarkerPlan,
  RESET_DURATION_MS,
  withCameraDefaults,
  type PlaceFlightPlan,
} from "./placeNavigation";
import {
  createMaplibreRenderer,
  type ArchetypeExpressionRenderMarker,
  type MapSurfaceRenderer,
  type MapViewState,
  type PlaceRenderMarker,
} from "./renderer";

const NO_FACETS: readonly TechnePlaceFacet[] = [];

/** The chrome's small pills share one ground, so the disclosure reads as one line. */
const DISCLOSURE_PILL = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "rgba(9,13,19,.82)",
  color: "var(--ob-dim, #8797ab)",
  fontSize: 11,
} as const;

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export interface PsychogeographicMapProps {
  /** Put genuine map controls in the host toolbar instead of beneath it. */
  toolbarContainer?: HTMLElement;
  inspectorContainer?: HTMLElement;
  repository: PlacesRepository;
  projectId: string;
  tileSource: MapTileSource;
  policy?: LiveServicePolicy;
  /** Hosted native applications do not delegate network authority to this UI. */
  offlineOnly?: boolean;
  /** Attribution lines of the other sources behind this surface's data (the geography pack's providers). */
  sourceAttributions?: readonly string[];
  renderer?: MapSurfaceRenderer;
  /** Invalidates repository reads without recreating the map or its camera. */
  refreshVersion?: number;
  initialViewState?: MapViewState;
  initialSelectedGraphNodeId?: string | null;
  onViewStateChange?: (viewState: MapViewState) => void;
  onSelectedGraphNodeIdChange?: (graphNodeId: string | null) => void;
  onOpenCanvasNode?: (graphNodeId: string) => void | Promise<void>;
  /** Hands the host the fly-to choreography (`flyToPlace`), as the Canvas hands `flyToNode`. */
  onRegisterFlyToPlace?: (flyToPlace: (graphNodeId: string) => PlaceFlightPlan | null) => void;
  /** The reading's full spatial facets (the cradle's `TechnePlaceFacet`s, unfiltered). When given, the map draws relation layers, a legend, and region polygons from them. */
  placeFacets?: readonly TechnePlaceFacet[];
  /** The presentation filter the side panel also writes. Layers and markers read it; it never changes the reading. */
  layerFilter?: PlaceFilterState;
  /** Asked for the next filter when a layer is toggled, so the side panel and the map read one state. Absent: the layers panel shows the legend only. */
  onLayerFilterChange?: (next: PlaceFilterState) => void;
}

/**
 * Surface #3 Places: a globe-first, project-wide projection of canonical
 * Temporal Places. It is deliberately not a Story walk. The surface queries
 * its PlacesRepository for every located project node, durable movement lanes,
 * and archetypal expressions; live tiles remain an explicit opt-in enhancement
 * over the bundled/offline base.
 */
export function PsychogeographicMap({
  toolbarContainer,
  inspectorContainer,
  repository,
  projectId,
  tileSource,
  policy,
  offlineOnly = false,
  sourceAttributions = [],
  renderer: rendererProp,
  refreshVersion = 0,
  initialViewState,
  initialSelectedGraphNodeId = null,
  onViewStateChange,
  onSelectedGraphNodeIdChange,
  onOpenCanvasNode,
  onRegisterFlyToPlace,
  placeFacets = NO_FACETS,
  layerFilter,
  onLayerFilterChange,
}: PsychogeographicMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRenderer = useRef<MapSurfaceRenderer | null>(null);
  const placeClickRef = useRef<(graphNodeId: string) => void>(() => {});
  const placeDoubleClickRef = useRef<(graphNodeId: string) => void>(() => {});
  const laneClickRef = useRef<(laneId: string) => void>(() => {});
  const initialViewStateRef = useRef<MapViewState | undefined>(initialViewState);
  const onViewStateChangeRef = useRef(onViewStateChange);
  const onSelectedGraphNodeIdChangeRef = useRef(onSelectedGraphNodeIdChange);
  onViewStateChangeRef.current = onViewStateChange;
  onSelectedGraphNodeIdChangeRef.current = onSelectedGraphNodeIdChange;

  const [renderer, setRenderer] = useState<MapSurfaceRenderer | null>(rendererProp ?? null);
  const [readyRenderer, setReadyRenderer] = useState<MapSurfaceRenderer | null>(null);
  const [view, setView] = useState<"globe" | "flat">("globe");
  const [viewState, setViewState] = useState<MapViewState>(() =>
    withCameraDefaults(initialViewState ?? defaultPlaceView()),
  );
  // Why the last fly-to did not fly (an unlocated place, say), named for the reader.
  const [flightNotice, setFlightNotice] = useState<string | null>(null);
  const [nodes, setNodes] = useState<LocatedGraphNode[]>([]);
  const [lanes, setLanes] = useState<GeographyEdge[]>([]);
  const [expressionsByPlace, setExpressionsByPlace] = useState<Map<string, ArchetypalExpression[]>>(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSelectedGraphNodeId);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (!inspectorContainer) return;
    inspectorContainer.hidden = selectedNodeId === null || !detailsOpen;
    return () => { inspectorContainer.hidden = true; };
  }, [inspectorContainer, selectedNodeId, detailsOpen]);
  useEffect(() => {
    if (selectedNodeId === null || (inspectorContainer && !detailsOpen)) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      if (inspectorContainer) setDetailsOpen(false);
      else { setSelectedNodeId(null); onSelectedGraphNodeIdChangeRef.current?.(null); }
      containerRef.current?.querySelector<HTMLElement>('canvas')?.focus();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [selectedNodeId, inspectorContainer, detailsOpen]);
  const [relatedNodes, setRelatedNodes] = useState<GraphNodeContract[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readAttempt, setReadAttempt] = useState(0);
  const [policyRevision, setPolicyRevision] = useState(0);
  const [liveTilesActive, setLiveTilesActive] = useState(false);
  const [liveFallback, setLiveFallback] = useState(false);
  // The live source on screen (null when none), and the owner's reason it failed, verbatim.
  const [activeLiveSource, setActiveLiveSource] = useState<MapTileSource | null>(null);
  const [liveFailure, setLiveFailure] = useState<string | null>(null);
  const [activeLaneYear, setActiveLaneYear] = useState<number | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);

  const tileRefreshOptedIn = !offlineOnly && !!policy?.isOptedIn("tile_refresh");
  void policyRevision;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      repository.getLocatedNodes(projectId),
      repository.getGeographyEdges(projectId),
    ])
      .then(async ([locatedNodes, geographyEdges]) => {
        const expressionRows = await Promise.all(
          locatedNodes.map(async (node) => {
            const expressions = await repository.getArchetypeExpressionsForPlace(projectId, node.graphNodeId);
            return [node.graphNodeId, expressions] as const;
          }),
        );
        if (cancelled) return;
        setNodes(locatedNodes);
        setLanes(geographyEdges);
        setExpressionsByPlace(new Map(expressionRows));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshVersion, repository, readAttempt]);

  // T8/T9: the reading's own facets decide the relation layers, the legend and the
  // region polygons. The filter is the one the side panel writes; it narrows what is
  // shown and never changes the reading.
  const layerState = layerFilter ?? OPEN_PLACE_FILTER;
  const layers = useMemo<PlaceLayer[]>(() => placeLayers(placeFacets), [placeFacets]);
  const polygonRefs = useMemo(() => polygonPlaceRefs(placeFacets), [placeFacets]);
  const hiddenRefs = useMemo(() => placeRefsHidden(placeFacets, layerState), [placeFacets, layerState]);
  const regions = useMemo<PlaceRegion[]>(() => placeRegions(placeFacets, layerState), [placeFacets, layerState]);
  const regionAnchors = useMemo(
    () => new Map(regions.map((region) => [region.place_ref, region.anchor] as const)),
    [regions],
  );

  // T11/T12: the route and the LOCATED_IN edges read the same presentation filter as the
  // layers. Both are narrowed views of the reading's own facets; neither rewrites them.
  const admitted = useMemo(() => admittedFacets(placeFacets, layerState), [placeFacets, layerState]);
  const route = useMemo<PlaceRouteDraw | null>(
    () => placeRouteForMap(admitted, layerState.window),
    [admitted, layerState.window],
  );
  const hierarchyEdges = useMemo<HierarchyEdgeDraw[]>(
    () => placeHierarchy(placeFacets, new Set(admitted.map((facet) => facet.place_ref)), layerState.window).drawn,
    [placeFacets, admitted, layerState.window],
  );

  const placeMarkers = useMemo<PlaceRenderMarker[]>(() => nodes.flatMap((node) => {
    // A region is drawn as its polygon, never also as a point; a place the filter hides is absent.
    if (polygonRefs.has(node.graphNodeId) || hiddenRefs.has(node.graphNodeId)) return [];
    const point = pointForPlace(node);
    if (!point) return [];
    // The precision grammar decides whether a place is drawn at all: an
    // unlocated place has no marker plan and stays in the register, never at (0,0).
    if (!placeMarkerPlan({ precision: node.place.coordinate.precision, ...point })) return [];
    return [{
      graphNodeId: node.graphNodeId,
      title: node.title,
      latitude: point.latitude,
      longitude: point.longitude,
      precision: node.place.coordinate.precision,
      entityType: node.entityType,
    }];
  }), [nodes, polygonRefs, hiddenRefs]);

  const expressionMarkers = useMemo<ArchetypeExpressionRenderMarker[]>(() => {
    const pointsByPlace = new Map(
      nodes.flatMap((node): ReadonlyArray<readonly [string, { latitude: number; longitude: number }]> => {
        if (hiddenRefs.has(node.graphNodeId)) return [];
        // A region's expressions sit at its label anchor, never at a point marker.
        if (polygonRefs.has(node.graphNodeId)) {
          const anchor = regionAnchors.get(node.graphNodeId);
          return anchor ? [[node.graphNodeId, { latitude: anchor[1], longitude: anchor[0] }] as const] : [];
        }
        const point = pointForPlace(node);
        return point ? [[node.graphNodeId, point] as const] : [];
      }),
    );
    return [...expressionsByPlace.entries()].flatMap(([placeGraphNodeId, expressions]) => {
      const point = pointsByPlace.get(placeGraphNodeId);
      if (!point) return [];
      return expressions.map((expression) => ({
        expressionId: expression.id,
        placeGraphNodeId,
        latitude: point.latitude,
        longitude: point.longitude,
        title: `${expression.expressionKind} · ${expression.timeWindow.start}`,
      }));
    });
  }, [expressionsByPlace, nodes, hiddenRefs, polygonRefs, regionAnchors]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.graphNodeId === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedExpressions = selectedNode
    ? expressionsByPlace.get(selectedNode.graphNodeId) ?? []
    : [];

  useEffect(() => {
    if (!selectedNodeId || !nodes.some((node) => node.graphNodeId === selectedNodeId)) {
      setRelatedNodes([]);
      setContextLoading(false);
      return;
    }
    let cancelled = false;
    setRelatedNodes([]);
    setContextLoading(true);
    void repository.getRelatedNodesForPlace(projectId, selectedNodeId)
      .then((related) => {
        if (!cancelled) setRelatedNodes(related);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(`Place context unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nodes, projectId, repository, selectedNodeId, readAttempt]);

  const laneYearRange = useMemo(() => {
    if (lanes.length === 0) return null;
    const years = lanes.flatMap((lane) => [
      temporalBoundYear(lane.timeWindow.start),
      temporalBoundYear(lane.timeWindow.end),
    ]);
    return [Math.min(...years), Math.max(...years)] as [number, number];
  }, [lanes]);

  const filteredLanes = useMemo(() => {
    if (activeLaneYear === null) return lanes;
    return lanes.filter((lane) => {
      const start = temporalBoundYear(lane.timeWindow.start);
      const end = temporalBoundYear(lane.timeWindow.end);
      return start <= activeLaneYear && activeLaneYear <= end;
    });
  }, [activeLaneYear, lanes]);

  const selectedLane = useMemo(
    () => lanes.find((lane) => lane.id === selectedLaneId) ?? null,
    [lanes, selectedLaneId],
  );
  const renderDataRef = useRef({ placeMarkers, expressionMarkers, filteredLanes, regions, route, hierarchyEdges });
  renderDataRef.current = { placeMarkers, expressionMarkers, filteredLanes, regions, route, hierarchyEdges };

  // T2: the flight to a place. The zoom and the marker both come from the
  // place's own precision; an unlocated place does not fly and is named instead.
  const flyToPlace = useCallback((graphNodeId: string): PlaceFlightPlan | null => {
    const node = nodes.find((candidate) => candidate.graphNodeId === graphNodeId);
    if (!node) return null;
    const plan = planPlaceFlight({
      precision: node.place.coordinate.precision,
      title: node.title,
      point: pointForPlace(node),
      from: { latitude: viewState.latitude, longitude: viewState.longitude },
    });
    if (!plan.flies) {
      setFlightNotice(plan.note);
      return plan;
    }
    setFlightNotice(null);
    void mountedRenderer.current?.flyTo?.(plan.latitude, plan.longitude, plan.zoom, {
      durationMs: plan.durationMs,
      easing: plan.easing,
      pulseGraphNodeId: graphNodeId,
    });
    return plan;
  }, [nodes, viewState.latitude, viewState.longitude]);

  const selectPlace = useCallback((graphNodeId: string) => {
    const node = nodes.find((candidate) => candidate.graphNodeId === graphNodeId);
    if (!node) return;
    setSelectedNodeId(graphNodeId);
    onSelectedGraphNodeIdChangeRef.current?.(graphNodeId);
    flyToPlace(graphNodeId);
  }, [flyToPlace, nodes]);
  placeClickRef.current = selectPlace;

  useEffect(() => {
    onRegisterFlyToPlace?.(flyToPlace);
  }, [flyToPlace, onRegisterFlyToPlace]);

  const openPlaceOnCanvas = useCallback((graphNodeId: string) => {
    selectPlace(graphNodeId);
    void onOpenCanvasNode?.(graphNodeId);
  }, [onOpenCanvasNode, selectPlace]);
  placeDoubleClickRef.current = openPlaceOnCanvas;

  const selectLane = useCallback((laneId: string) => {
    const lane = lanes.find((candidate) => candidate.id === laneId);
    if (!lane) return;
    setSelectedLaneId(laneId);
    const coordinates = lane.geometry.coordinates;
    if (coordinates.length >= 2) {
      const mid = coordinates[Math.floor(coordinates.length / 2)];
      void mountedRenderer.current?.flyTo?.(mid[1], mid[0], 3);
    }
  }, [lanes]);
  laneClickRef.current = selectLane;

  useEffect(() => {
    let cancelled = false;
    if (rendererProp) {
      setRenderer(rendererProp);
      return;
    }
    void createMaplibreRenderer().then((adapter) => {
      if (!cancelled) setRenderer(adapter);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [rendererProp]);

  useEffect(() => {
    if (!renderer || !containerRef.current) return;
    let cancelled = false;
    setReadyRenderer(null);
    // Map construction and repository reads race legitimately. Do not draw a
    // captured startup snapshot here: a late style load used to erase newer
    // markers with the empty list captured when create() began. Readiness is
    // its own invalidation signal; the effects below always see current data.
    void renderer.create(containerRef.current, tileSource, { projection: "globe" })
      .then(async () => {
        if (cancelled) return;
        renderer.setPlaceClickHandler?.((graphNodeId) => placeClickRef.current(graphNodeId));
        renderer.setPlaceDoubleClickHandler?.((graphNodeId) => placeDoubleClickRef.current(graphNodeId));
        renderer.setLaneClickHandler?.((laneId) => laneClickRef.current(laneId));
        renderer.onViewChange?.((nextViewState) => {
          if (cancelled) return;
          setViewState(nextViewState);
          onViewStateChangeRef.current?.(nextViewState);
        });
        const restoredViewState = initialViewStateRef.current;
        if (restoredViewState) {
          // Records saved before T1 carry no pitch or bearing: they restore untilted.
          const restored = withCameraDefaults(restoredViewState);
          await renderer.flyTo?.(
            restored.latitude,
            restored.longitude,
            restored.zoom,
            { pitch: restored.pitch, bearing: restored.bearing },
          );
        }
        if (cancelled) return;
        mountedRenderer.current = renderer;
        setReadyRenderer(renderer);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
      if (mountedRenderer.current === renderer) mountedRenderer.current = null;
      renderer.destroy();
    };
  }, [renderer, tileSource]);

  useEffect(() => {
    if (!readyRenderer || mountedRenderer.current !== readyRenderer) return;
    let cancelled = false;
    void Promise.all([
      readyRenderer.drawPlaces?.(placeMarkers, expressionMarkers),
      readyRenderer.drawLanes?.(filteredLanes),
      readyRenderer.drawRegions?.(regions),
      readyRenderer.drawRoutes?.(route),
      readyRenderer.drawHierarchy?.(hierarchyEdges),
    ]).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { cancelled = true; };
  }, [expressionMarkers, filteredLanes, hierarchyEdges, placeMarkers, readyRenderer, regions, route]);

  const setProjection = useCallback((next: "globe" | "flat") => {
    const currentRenderer = mountedRenderer.current;
    if (!currentRenderer) return;
    setView(next);
    void (async () => {
      try {
        await currentRenderer.setProjection?.(next);
        if (mountedRenderer.current !== currentRenderer) return;
        const latest = renderDataRef.current;
        await Promise.all([
          currentRenderer.drawPlaces?.(latest.placeMarkers, latest.expressionMarkers),
          currentRenderer.drawLanes?.(latest.filteredLanes),
          currentRenderer.drawRegions?.(latest.regions),
          currentRenderer.drawRoutes?.(latest.route),
          currentRenderer.drawHierarchy?.(latest.hierarchyEdges),
        ]);
      } catch (cause) {
        if (mountedRenderer.current === currentRenderer) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();
  }, []);

  const refreshLiveTiles = useCallback(async () => {
    if (offlineOnly || !policy) return;
    const currentRenderer = mountedRenderer.current;
    if (!currentRenderer) return;
    if (policy.requestLiveAction("tile_refresh", "refresh live basemap tiles") !== "granted") return;
    const liveSource: MapTileSource = {
      kind: "raster",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap contributors",
    };
    try {
      await currentRenderer.setLiveTileSource(liveSource);
      if (mountedRenderer.current !== currentRenderer) return;
      setLiveTilesActive(true);
      setLiveFallback(false);
      setActiveLiveSource(liveSource);
      setLiveFailure(null);
    } catch (cause) {
      if (mountedRenderer.current !== currentRenderer) return;
      setLiveTilesActive(false);
      setLiveFallback(true);
      setActiveLiveSource(null);
      setLiveFailure(messageOf(cause));
      try {
        await currentRenderer.setLiveTileSource(tileSource);
      } catch {
        // The original offline surface stays mounted even if a source swap is
        // unsupported by a test/static renderer.
      }
    }
  }, [policy, tileSource, offlineOnly]);

  // T3: the compass returns bearing and tilt to north in place; globe home flies
  // to the default view. Both are eased and finish by their own clock.
  const returnToNorth = () => {
    const current = mountedRenderer.current;
    if (!current?.easeCamera) return;
    const target = northResetView(viewState);
    void current.easeCamera({ pitch: target.pitch, bearing: target.bearing, durationMs: RESET_DURATION_MS, easing: flightEase });
  };
  const goGlobeHome = () => {
    const current = mountedRenderer.current;
    if (!current?.flyTo) return;
    const home = defaultPlaceView();
    setFlightNotice(null);
    void current.flyTo(home.latitude, home.longitude, home.zoom, {
      pitch: home.pitch,
      bearing: home.bearing,
      durationMs: RESET_DURATION_MS,
      easing: flightEase,
    });
  };

  // T7: every network-loaded pixel is attributed here, and an unavailable source
  // names its owner's reason verbatim.
  const liveDisclosure = liveTileDisclosure({
    offlineOnly,
    hasPolicy: !!policy,
    optedIn: tileRefreshOptedIn,
    liveSource: activeLiveSource,
    failure: liveFallback ? liveFailure : null,
  });
  const imageryText = imageryReadout(tileSource, activeLiveSource);
  const attributionText = attributionReadout([
    tileSource.attribution,
    activeLiveSource?.attribution,
    ...sourceAttributions,
  ]);

  const connectionLabel = liveFallback
    ? "Live tiles (offline fallback)"
    : liveTilesActive
      ? "Live tiles"
      : "Offline";

  const controls = (
      <div
        className={toolbarContainer ? "psychogeographic-toolbar-hosted research-tool-actions" : "psychogeographic-toolbar"}
        data-testid="places-toolbar"
        style={toolbarContainer ? { display: "flex", gap: 6 } : {
          position: "absolute",
          zIndex: 10,
          top: 10,
          left: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 5,
          border: "1px solid var(--ob-line-3, #3a4e64)",
          borderRadius: 9,
          background: "rgba(17,24,37,.9)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button type="button" data-testid="places-globe-toggle" disabled={!readyRenderer} data-active={view === "globe"} onClick={() => setProjection("globe")}>Globe</button>
        <button type="button" data-testid="places-flat-toggle" disabled={!readyRenderer} data-active={view === "flat"} onClick={() => setProjection("flat")}>Flat</button>
        <button type="button" data-testid="places-zoom-fit" disabled={!readyRenderer || placeMarkers.length === 0} onClick={() => void mountedRenderer.current?.fitToPlaces?.(placeMarkers)}>Zoom to fit</button>
        <span data-testid="places-camera-readout" aria-label="Globe tilt and rotation" style={{ fontSize: 11, color: "var(--ob-dim, #8797ab)", whiteSpace: "nowrap" }}>
          Pitch {Math.round(viewState.pitch ?? 0)}° · Bearing {Math.round(viewState.bearing ?? 0)}°
        </span>
        <button type="button" data-testid="places-compass-reset" title="Return to north: bearing and tilt to zero" aria-label="Return to north" disabled={!readyRenderer} onClick={returnToNorth}>North</button>
        <button type="button" data-testid="places-globe-home" title="Globe home: the default view" aria-label="Globe home" disabled={!readyRenderer} onClick={goGlobeHome}>Globe home</button>
        {inspectorContainer && <button type="button" disabled={!selectedNodeId} aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}>Location details</button>}
        {!offlineOnly && policy && (!tileRefreshOptedIn ? (
          <button
            type="button"
            data-testid="psychogeographic-opt-in-live"
            onClick={() => {
              policy.optIn("tile_refresh", "refresh live basemap tiles");
              setPolicyRevision((revision) => revision + 1);
            }}
          >
            Enable live tiles
          </button>
        ) : (
          <button
            type="button"
            data-testid="psychogeographic-refresh-tiles"
            disabled={!readyRenderer}
            onClick={() => void refreshLiveTiles()}
          >
            Refresh tiles
          </button>
        ))}
      </div>
  );

  return (
    <div
      className="psychogeographic-surface"
      data-testid="psychogeographic-surface"
      data-view={view}
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#05070f" }}
    >
      {toolbarContainer ? createPortal(controls, toolbarContainer) : controls}

      <div
        ref={containerRef}
        className="psychogeographic-map"
        data-testid={view === "globe" ? "places-globe" : "places-flat-map"}
        data-ready={readyRenderer !== null}
        data-center={`${viewState.longitude.toFixed(4)},${viewState.latitude.toFixed(4)}`}
        data-pitch={viewState.pitch ?? 0}
        data-bearing={viewState.bearing ?? 0}
        style={{ position: "absolute", inset: 0 }}
      />

      {flightNotice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="places-flight-notice"
          style={{
            position: "absolute",
            left: 12,
            bottom: 42,
            zIndex: 9,
            maxWidth: 360,
            padding: "5px 9px",
            borderRadius: 9,
            background: "rgba(9,13,19,.82)",
            color: "#c9b68a",
            fontSize: 11,
          }}
        >
          {flightNotice}
        </div>
      )}

      <div
        className="psychogeographic-disclosure"
        data-testid="places-disclosure"
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          zIndex: 9,
          maxWidth: "calc(100% - 200px)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "4px 8px",
          pointerEvents: "none",
        }}
      >
        <div
          className="psychogeographic-connection"
          data-testid="places-connection-status"
          data-state={liveFallback ? "fallback" : liveTilesActive ? "live" : "offline"}
          aria-live="polite"
          style={DISCLOSURE_PILL}
        >
          {connectionLabel}
        </div>
        <span data-testid="places-imagery-readout" style={DISCLOSURE_PILL}>{imageryText}</span>
        <span data-testid="places-attribution" style={DISCLOSURE_PILL}>{attributionText}</span>
        {liveDisclosure.reason !== null ? (
          <span data-testid="places-live-unavailable" style={DISCLOSURE_PILL}>
            Live tiles unavailable: {liveDisclosure.reason}
          </span>
        ) : (
          <span data-testid="places-live-state" style={DISCLOSURE_PILL}>
            {liveDisclosure.disclosed.join(" · ")}
          </span>
        )}
      </div>

      {loading && (
        <div data-testid="places-loading" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: "#8797ab" }}>
          Reading project geography…
        </div>
      )}

      {!loading && nodes.length === 0 && !error && (
        <div data-testid="psychogeographic-empty" style={{ position: "absolute", left: 18, bottom: 48, zIndex: 7, color: "#8797ab", fontSize: 12 }}>
          No canonical Place projections are recorded in this project yet.
        </div>
      )}

      {selectedNode && (!inspectorContainer || detailsOpen) && (() => {
        const panel = <LocationPanel node={selectedNode} relatedNodes={relatedNodes}
          expressions={selectedExpressions} loadingContext={contextLoading}
          hosted={!!inspectorContainer}
          onClose={() => { if (inspectorContainer) setDetailsOpen(false); else { setSelectedNodeId(null); onSelectedGraphNodeIdChangeRef.current?.(null); } containerRef.current?.querySelector<HTMLElement>('canvas')?.focus(); }} />;
        return inspectorContainer ? createPortal(panel, inspectorContainer) : panel;
      })()}

      {lanes.length > 0 && (
        <div
          className="psychogeographic-lanes-panel"
          data-testid="psychogeographic-lanes-panel"
          style={{ position: "absolute", left: 12, top: 58, zIndex: 8, width: 290, maxHeight: "42%", overflow: "auto", padding: 10, borderRadius: 10, background: "rgba(17,24,37,.88)", border: "1px solid var(--ob-line, #1b2634)" }}
        >
          {laneYearRange && (
            <label className="psychogeographic-lane-filter" style={{ display: "grid", gap: 5, fontSize: 11 }}>
              <span>Lanes active in year · {activeLaneYear === null ? "all" : activeLaneYear}</span>
              <input
                type="range"
                data-testid="lane-year-filter"
                min={laneYearRange[0]}
                max={laneYearRange[1]}
                value={activeLaneYear ?? laneYearRange[1]}
                onChange={(event) => setActiveLaneYear(Number(event.target.value))}
              />
              <span data-testid="lane-year-value" hidden>{activeLaneYear === null ? "all" : activeLaneYear}</span>
              {activeLaneYear !== null && (
                <button type="button" data-testid="lane-year-clear" onClick={() => setActiveLaneYear(null)}>Show all</button>
              )}
            </label>
          )}
          <ol className="psychogeographic-lanes" data-testid="psychogeographic-lanes" style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
            {filteredLanes.map((lane) => (
              <li key={lane.id}>
                <button
                  type="button"
                  data-testid={`geography-lane-${lane.seedKey}`}
                  data-selected={selectedLaneId === lane.id ? "true" : "false"}
                  data-mode={lane.mode}
                  onClick={() => selectLane(lane.id)}
                  style={{ width: "100%", textAlign: "left" }}
                >
                  {lane.label} · {lane.mode}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {layers.length > 0 && (
        <div
          className="psychogeographic-layers-panel"
          data-testid="places-layers-panel"
          style={{ position: "absolute", right: 12, top: 58, zIndex: 8, width: 260, maxHeight: "46%", overflow: "auto", padding: 10, borderRadius: 10, background: "rgba(17,24,37,.88)", border: "1px solid var(--ob-line, #1b2634)", fontSize: 11 }}
        >
          <h3 style={{ margin: "0 0 6px", fontSize: 12 }}>Layers · relation</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
            {layers.map((layer) => {
              const standingOff = layerState.standing !== null && !layerState.standing.has(layer.standingClass);
              return (
                <li key={layer.relation}>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    title={standingOff ? "Its standing is filtered off in the side panel" : layer.relation}
                  >
                    <input
                      type="checkbox"
                      data-testid={`places-layer-${layer.relation}`}
                      checked={layerVisible(layerState, layer)}
                      disabled={!onLayerFilterChange || standingOff}
                      onChange={() => onLayerFilterChange?.(toggleLayer(layerState, layers, layer.relation))}
                    />
                    <LayerSwatch drawing={layer.drawing} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{layer.relation}</span>
                    <span data-testid={`places-layer-count-${layer.relation}`} style={{ color: "var(--ob-dim, #8797ab)" }}>{layer.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div data-testid="places-legend" style={{ marginTop: 8, display: "grid", gap: 3 }}>
            {[...new Map(layers.map((layer) => [layer.visual, layer.drawing] as const)).entries()].map(([visual, drawing]) => (
              <div key={visual} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <LayerSwatch drawing={drawing} />
                <span>{standingLabel(visual)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedLane && (
        <aside className="psychogeographic-lane-provenance" data-testid="lane-provenance" style={{ position: "absolute", left: 12, bottom: 46, zIndex: 9, width: 320, maxHeight: "38%", overflow: "auto", padding: 12, borderRadius: 10, background: "rgba(17,24,37,.94)", border: "1px solid var(--ob-line-3, #3a4e64)" }}>
          <h3 style={{ marginTop: 0 }}>{selectedLane.label}</h3>
          <dl>
            <dt>Mode</dt><dd>{selectedLane.mode}</dd>
            <dt>Time window</dt><dd>{selectedLane.timeWindow.start} – {selectedLane.timeWindow.end}</dd>
            <dt>Route</dt><dd>{selectedLane.sourcePlaceId} → {selectedLane.targetPlaceId}</dd>
          </dl>
          <h4>Source passages</h4>
          <ul>
            {selectedLane.provenance.sourceRefs.map((ref, index) => (
              <li key={index}>
                {ref.artifactId}
                {ref.unit.kind === "text_span" && <span> · chars {ref.unit.startOffset}–{ref.unit.endOffset}</span>}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {error && (
        <div role="alert" data-testid="psychogeographic-error" style={{ position: "absolute", right: 12, bottom: 12, zIndex: 11 }}>
          Map unavailable: {error}
          <button type="button" onClick={() => setReadAttempt(value => value + 1)}>Retry reading</button>
        </div>
      )}
    </div>
  );
}

/** A standing's line sample, drawn with the one shared drawing table (timeline/standingStyle). */
function LayerSwatch({ drawing }: { drawing: StandingDrawing }): JSX.Element {
  return (
    <svg width={18} height={8} aria-hidden="true" focusable="false" style={{ flex: "none" }}>
      <line x1={0} y1={4} x2={18} y2={4} stroke={drawing.stroke} strokeWidth={2} strokeDasharray={drawing.dash} />
    </svg>
  );
}

function temporalBoundYear(value: string): number {
  const match = /^(\d{4})/.exec(value);
  return match ? Number(match[1]) : 0;
}
