/**
 * Lane-4 T4/T5 — the basemap source registry, as data. Pure: no DOM, no maplibre.
 *
 * The bundled offline pack is the ground and is never listed here. Every entry
 * below is a network source the owner may opt into through the surface's
 * LiveServicePolicy gate (`tile_refresh`); nothing is fetched until that gate
 * grants it. Each entry carries the credit line and the licence that the map
 * draws whenever pixels from it are on screen.
 *
 * Erasable TypeScript: loadable by Vite, the surface and `node --test`.
 */

export type BasemapFamily = "street" | "satellite" | "hybrid" | "terrain";

export interface BasemapSourceDefinition {
  /** Stable key: the stack's row id, and the stem of the MapLibre source and layer ids. */
  id: string;
  family: BasemapFamily;
  /** The row's name on the layer control. */
  name: string;
  /** Imagery tiles, or elevation tiles read as terrain. */
  kind: "raster" | "raster-dem";
  /** XYZ tile URL template. */
  tiles: string;
  tileSize: number;
  maxZoom: number;
  /** The credit the surface renders whenever pixels from this source are on screen. */
  attribution: string;
  /** The licence the source is offered under, drawn beside its credit. */
  licence: string;
  /** The DEM encoding (raster-dem only). */
  encoding?: "terrarium";
}

/** The bundled offline pack's row id in the stack. It is the bottom of every stack. */
export const OFFLINE_GROUND_ID = "offline-ground";

/** Imagery layers, bottom to top: this order is the stacking order on the map. */
export const LIVE_BASEMAP_SOURCES: readonly BasemapSourceDefinition[] = [
  {
    id: "osm-street",
    family: "street",
    name: "OpenStreetMap standard",
    kind: "raster",
    tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileSize: 256,
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
    licence: "ODbL 1.0 data; OSM tile usage policy",
  },
  {
    id: "eox-sentinel2",
    family: "satellite",
    name: "Sentinel-2 cloudless",
    kind: "raster",
    tiles: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
    tileSize: 256,
    maxZoom: 14,
    attribution: "Sentinel-2 cloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)",
    licence: "CC BY 4.0",
  },
  {
    id: "esri-imagery",
    family: "satellite",
    name: "Esri World Imagery",
    kind: "raster",
    tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    tileSize: 256,
    maxZoom: 18,
    attribution: "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    licence: "Esri terms of use; attribution required",
  },
  {
    id: "esri-place-names",
    family: "hybrid",
    name: "Esri place names (hybrid overlay)",
    kind: "raster",
    tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    tileSize: 256,
    maxZoom: 18,
    attribution: "Esri World Boundaries and Places: Esri, HERE, Garmin, FAO, NOAA, USGS, EPA, NPS",
    licence: "Esri terms of use; attribution required",
  },
];

/** Elevation for the globe, read as terrain (lane-4 T5). */
export const TERRAIN_BASEMAP_SOURCE: BasemapSourceDefinition = {
  id: "terrain-dem",
  family: "terrain",
  name: "Terrain elevation",
  kind: "raster-dem",
  tiles: "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png",
  tileSize: 256,
  maxZoom: 15,
  attribution: "Terrain Tiles: Mapzen, AWS Open Data",
  licence: "Mixed open terrain sources (Joerd attribution)",
  encoding: "terrarium",
};
