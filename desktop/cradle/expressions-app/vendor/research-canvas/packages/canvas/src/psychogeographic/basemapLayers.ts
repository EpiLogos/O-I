/**
 * Lane-4 T4/T5 — the basemap layer stack, as pure logic. No DOM, no maplibre.
 *
 * A stack is the offline ground at the bottom, then the live imagery sources in
 * registry order, with optional terrain. Each row carries a visibility and an
 * opacity. A live row draws only when the surface's live gate is open and the
 * renderer has not refused its source; otherwise it draws nothing, and its row
 * names the owner's reason (verbatim), never a stand-in.
 *
 * Laws: the default stack draws exactly what the surface drew before T4 (the
 * offline ground, fully opaque, nothing else). Every network-loaded pixel is
 * credited in `attributions`, and only the pixels on screen are credited.
 *
 * Erasable TypeScript: loadable by Vite, the surface and `node --test`.
 */
import { HOSTED_NETWORK_REASON, NO_POLICY_REASON, OPT_IN_REASON } from "./disclosure";
import {
  LIVE_BASEMAP_SOURCES,
  OFFLINE_GROUND_ID,
  TERRAIN_BASEMAP_SOURCE,
  type BasemapFamily,
  type BasemapSourceDefinition,
} from "./basemapSources";

export interface BasemapLayerState {
  visible: boolean;
  /** 0 to 1. */
  opacity: number;
}

export interface BasemapStack {
  /** Per-layer state keyed by id: the offline ground, then every live source. */
  readonly layers: Readonly<Record<string, BasemapLayerState>>;
  /** Terrain is a layer of its own, read as elevation under the imagery. */
  readonly terrainVisible: boolean;
}

/** The stack the surface starts from: the offline ground only, as before T4. */
export function defaultBasemapStack(): BasemapStack {
  const layers: Record<string, BasemapLayerState> = {
    [OFFLINE_GROUND_ID]: { visible: true, opacity: 1 },
  };
  for (const source of LIVE_BASEMAP_SOURCES) layers[source.id] = { visible: false, opacity: 1 };
  return { layers, terrainVisible: false };
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function setBasemapVisible(stack: BasemapStack, id: string, visible: boolean): BasemapStack {
  const current = stack.layers[id];
  if (!current) return stack;
  return { ...stack, layers: { ...stack.layers, [id]: { ...current, visible } } };
}

export function setBasemapOpacity(stack: BasemapStack, id: string, opacity: number): BasemapStack {
  const current = stack.layers[id];
  if (!current) return stack;
  return { ...stack, layers: { ...stack.layers, [id]: { ...current, opacity: clampOpacity(opacity) } } };
}

export function setTerrainVisible(stack: BasemapStack, visible: boolean): BasemapStack {
  return { ...stack, terrainVisible: visible };
}

/** Takes every live source and the terrain off the stack; the offline ground stays as it was. */
export function hideLiveBasemaps(stack: BasemapStack): BasemapStack {
  const layers: Record<string, BasemapLayerState> = { ...stack.layers };
  for (const source of LIVE_BASEMAP_SOURCES) {
    const current = layers[source.id];
    if (current) layers[source.id] = { ...current, visible: false };
  }
  return { layers, terrainVisible: false };
}

/** What the surface knows of the live gate: the host's offline stance, the policy, and its opt-in. */
export interface BasemapGate {
  offlineOnly: boolean;
  hasPolicy: boolean;
  optedIn: boolean;
}

/** The reason a live source cannot draw, in the owner's own words; null when the gate is open. */
export function basemapGateReason(gate: BasemapGate): string | null {
  if (gate.offlineOnly) return HOSTED_NETWORK_REASON;
  if (!gate.hasPolicy) return NO_POLICY_REASON;
  if (!gate.optedIn) return OPT_IN_REASON;
  return null;
}

export interface BasemapRow {
  id: string;
  name: string;
  family: BasemapFamily | "ground";
  visible: boolean;
  opacity: number;
  /** A row can be switched on only while the gate is open. */
  enabled: boolean;
  /** The renderer's own refusal of this source, verbatim; null when none. */
  failure: string | null;
  attribution: string;
  licence: string;
}

function rowFor(
  definition: BasemapSourceDefinition,
  stack: BasemapStack,
  gate: BasemapGate,
  failures: Readonly<Record<string, string>>,
): BasemapRow {
  const state = stack.layers[definition.id] ?? { visible: false, opacity: 1 };
  return {
    id: definition.id,
    name: definition.name,
    family: definition.family,
    visible: state.visible,
    opacity: state.opacity,
    enabled: basemapGateReason(gate) === null,
    failure: failures[definition.id] ?? null,
    attribution: definition.attribution,
    licence: definition.licence,
  };
}

/** The offline ground, then each live imagery source, bottom to top. */
export function basemapRows(
  stack: BasemapStack,
  gate: BasemapGate,
  failures: Readonly<Record<string, string>>,
): BasemapRow[] {
  const ground = stack.layers[OFFLINE_GROUND_ID] ?? { visible: true, opacity: 1 };
  const groundRow: BasemapRow = {
    id: OFFLINE_GROUND_ID,
    name: "Offline ground · bundled pack",
    family: "ground",
    visible: ground.visible,
    opacity: ground.opacity,
    enabled: true,
    failure: null,
    attribution: "",
    licence: "bundled offline pack",
  };
  return [groundRow, ...LIVE_BASEMAP_SOURCES.map((source) => rowFor(source, stack, gate, failures))];
}

/** The terrain row: the same gate, its own visibility, and no opacity (elevation is not drawn as paint). */
export function terrainBasemapRow(
  stack: BasemapStack,
  gate: BasemapGate,
  failures: Readonly<Record<string, string>>,
): BasemapRow {
  return {
    id: TERRAIN_BASEMAP_SOURCE.id,
    name: TERRAIN_BASEMAP_SOURCE.name,
    family: "terrain",
    visible: stack.terrainVisible,
    opacity: 1,
    enabled: basemapGateReason(gate) === null,
    failure: failures[TERRAIN_BASEMAP_SOURCE.id] ?? null,
    attribution: TERRAIN_BASEMAP_SOURCE.attribution,
    licence: TERRAIN_BASEMAP_SOURCE.licence,
  };
}

/** One raster source as the renderer draws it, bottom to top in `rasters`. */
export interface BasemapRasterDraw {
  key: string;
  layerId: string;
  sourceId: string;
  tiles: string[];
  tileSize: number;
  maxZoom: number;
  opacity: number;
  attribution: string;
  licence: string;
}

export interface BasemapTerrainDraw {
  key: string;
  sourceId: string;
  tiles: string[];
  tileSize: number;
  maxZoom: number;
  encoding: "terrarium";
  attribution: string;
  licence: string;
}

/** What the renderer should hold on the map for this stack, and the credits for it. */
export interface BasemapRenderPlan {
  ground: { visible: boolean; opacity: number };
  rasters: BasemapRasterDraw[];
  terrain: BasemapTerrainDraw | null;
  /** One credit per drawn source, its licence beside it. Empty when only the offline ground draws. */
  attributions: string[];
}

/** Composes the map's basemap from the stack, the gate and the renderer's refusals. Pure. */
export function composeBasemapPlan(
  stack: BasemapStack,
  gate: BasemapGate,
  failures: Readonly<Record<string, string>>,
): BasemapRenderPlan {
  const open = basemapGateReason(gate) === null;
  const rasters: BasemapRasterDraw[] = [];
  for (const source of LIVE_BASEMAP_SOURCES) {
    const state = stack.layers[source.id];
    if (!open || !state?.visible || failures[source.id]) continue;
    rasters.push({
      key: source.id,
      layerId: `basemap-${source.id}-layer`,
      sourceId: `basemap-${source.id}`,
      tiles: [source.tiles],
      tileSize: source.tileSize,
      maxZoom: source.maxZoom,
      opacity: state.opacity,
      attribution: source.attribution,
      licence: source.licence,
    });
  }
  const terrainOn = open && stack.terrainVisible && !failures[TERRAIN_BASEMAP_SOURCE.id];
  const terrain: BasemapTerrainDraw | null = terrainOn
    ? {
        key: TERRAIN_BASEMAP_SOURCE.id,
        sourceId: `basemap-${TERRAIN_BASEMAP_SOURCE.id}`,
        tiles: [TERRAIN_BASEMAP_SOURCE.tiles],
        tileSize: TERRAIN_BASEMAP_SOURCE.tileSize,
        maxZoom: TERRAIN_BASEMAP_SOURCE.maxZoom,
        encoding: "terrarium",
        attribution: TERRAIN_BASEMAP_SOURCE.attribution,
        licence: TERRAIN_BASEMAP_SOURCE.licence,
      }
    : null;
  const ground = stack.layers[OFFLINE_GROUND_ID] ?? { visible: true, opacity: 1 };
  const attributions = [
    ...rasters.map((draw) => `${draw.attribution} [${draw.licence}]`),
    ...(terrain ? [`${terrain.attribution} [${terrain.licence}]`] : []),
  ];
  return {
    ground: { visible: ground.visible, opacity: ground.opacity },
    rasters,
    terrain,
    attributions,
  };
}

/** The top-most live imagery on screen, for the imagery readout and the live disclosure; null when none. */
export function topLiveRaster(plan: BasemapRenderPlan): { url: string; attribution: string } | null {
  const top = plan.rasters[plan.rasters.length - 1];
  return top ? { url: top.tiles[0], attribution: top.attribution } : null;
}

export const NO_TERRAIN_SOURCE = "No terrain source";

export interface TerrainReadoutInput {
  /** The terrain layer is drawn on the map. */
  active: boolean;
  /** The selected place, when there is one. `located` is false for a place without a coordinate. */
  selected: { title: string; located: boolean; elevationMeters: number | null } | null;
}

/** The terrain readout line. Terrain off or unavailable reads "No terrain source", never a horizon. */
export function terrainReadout(input: TerrainReadoutInput): string {
  if (!input.active) return NO_TERRAIN_SOURCE;
  if (input.selected === null) return "Terrain on · select a place for its elevation";
  if (!input.selected.located) return `${input.selected.title}: no coordinate, so no elevation`;
  if (input.selected.elevationMeters === null) return `Elevation at ${input.selected.title}: not loaded yet`;
  return `Elevation at ${input.selected.title}: ${Math.round(input.selected.elevationMeters)} m`;
}
