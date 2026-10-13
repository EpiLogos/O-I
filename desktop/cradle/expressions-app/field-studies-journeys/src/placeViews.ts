/** Lane-4 T20 — named Places views, as pure logic (no DOM, no maplibre).
 *
 * A view records what the person saw on the Places map: the camera (pitch and bearing
 * included), the layer toggles, the basemap rows with their opacities, and the shared time
 * window. It holds refs and presentation only, never a copy of the reading.
 *
 * Laws:
 * - Restoring a view never grants live sources. The owner's "Allow live sources" switch is
 *   not part of a view; the restored rows draw only if the owner has already allowed them.
 * - Absent records mean today's defaults: every layer on, the offline ground only.
 */
import {
  clampOpacity,
  defaultBasemapStack,
  setBasemapOpacity,
  setBasemapVisible,
  setTerrainVisible,
  type BasemapStack,
} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/basemapLayers';
import {LIVE_BASEMAP_SOURCES, OFFLINE_GROUND_ID} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/basemapSources';
import {
  defaultPlaceView,
  placeRecordFromViewState,
  viewStateFromPlaceRecord,
  withCameraDefaults,
  type PlaceViewState,
} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/placeNavigation';
import {OPEN_PLACE_FILTER, type PlaceFilterState} from './placeReading.js';
import {PLACE_VIEW_LIMIT, type PlaceBasemapRecord, type PlaceLayersRecord, type PlaceStanding, type PlaceTimeWindowRecord, type PlaceViewRecord} from './researchMaterial.js';

/** The basemap rows a record keeps: the offline ground, then each live source (terrain is its own flag). */
const BASEMAP_ROW_IDS: readonly string[] = [OFFLINE_GROUND_ID, ...LIVE_BASEMAP_SOURCES.map(source => source.id)];

/** The reason a view cannot be saved under this name, in the owner's words; null when it can. */
export function placeViewNameProblem(name: string, existing: Readonly<Record<string, unknown>>): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name the view first.';
  if (trimmed.length > 160) return 'A view name is at most 160 characters.';
  if (!(trimmed in existing) && Object.keys(existing).length >= PLACE_VIEW_LIMIT) {
    return `A Scene keeps at most ${PLACE_VIEW_LIMIT} place views. Remove one before saving another.`;
  }
  return null;
}

/** The basemap rows as a record keeps them: every row's visibility and opacity, and the terrain flag. */
export function basemapRecordOf(stack: BasemapStack): PlaceBasemapRecord {
  const layers: Record<string, {visible: boolean; opacity: number}> = {};
  for (const id of BASEMAP_ROW_IDS) {
    const state = stack.layers[id] ?? {visible: false, opacity: 1};
    layers[id] = {visible: state.visible, opacity: clampOpacity(state.opacity)};
  }
  return {terrainVisible: stack.terrainVisible, layers};
}

/** The stack a basemap record restores, from the defaults: each recorded row is set as saved, so the restored stack is the saved one. Absent = the defaults. */
export function basemapFromRecord(record: PlaceBasemapRecord | undefined): BasemapStack {
  let stack = defaultBasemapStack();
  if (!record) return stack;
  for (const id of BASEMAP_ROW_IDS) {
    const row = record.layers[id];
    if (!row) continue;
    stack = setBasemapOpacity(setBasemapVisible(stack, id, row.visible), id, row.opacity);
  }
  return setTerrainVisible(stack, record.terrainVisible);
}

/** The layer toggles a filter holds, as a record keeps them. An open filter keeps no list (every layer on). */
export function layersRecordOf(filter: PlaceFilterState, stack: BasemapStack): PlaceLayersRecord {
  const record: PlaceLayersRecord = {basemap: basemapRecordOf(stack)};
  if (filter.relations) record.relations = [...filter.relations].sort();
  if (filter.standing) record.standing = [...filter.standing].sort() as PlaceStanding[];
  return record;
}

/** lane-4 T21: the layers a Scene keeps, restored as the session holds them: the filter and the basemap stack. Absent = today's
 * defaults (every layer on, the offline ground only). The owner's live-source allowance is never part of it. */
export function restoreLayers(record: PlaceLayersRecord | undefined): {filter: PlaceFilterState; stack: BasemapStack} {
  if (!record) return {filter: OPEN_PLACE_FILTER, stack: defaultBasemapStack()};
  return {filter: filterFromLayersRecord(record), stack: basemapFromRecord(record.basemap)};
}

/** lane-4 T21: the canonical key of a layer state, the form a save writes. Equal keys mean the Scene already keeps these layers. */
export function layersKey(filter: PlaceFilterState, stack: BasemapStack): string {
  return JSON.stringify(layersRecordOf(filter, stack));
}

/** The presentation filter a layer record restores. The shared time window is not part of it; the view carries that separately. */
export function filterFromLayersRecord(record: PlaceLayersRecord): PlaceFilterState {
  if (record.relations === undefined && record.standing === undefined) return OPEN_PLACE_FILTER;
  return {
    relations: record.relations === undefined ? null : new Set(record.relations),
    standing: record.standing === undefined ? null : new Set(record.standing),
    window: null,
  };
}

/** A longitude already inside [-180, 180] is kept exactly; one past the antimeridian wraps in; latitude clamps to [-90, 90]. */
function boundedCamera(state: PlaceViewState & {pitch: number; bearing: number}): PlaceViewState & {pitch: number; bearing: number} {
  const inside = state.longitude >= -180 && state.longitude <= 180;
  const longitude = inside ? state.longitude : ((((state.longitude + 180) % 360) + 360) % 360) - 180;
  return {...state, longitude, latitude: Math.min(90, Math.max(-90, state.latitude))};
}

/** The shared time window as a view keeps it: null when both bounds are open. */
export function timeWindowRecordOf(window: {from: string | null; to: string | null} | null | undefined): PlaceTimeWindowRecord | null {
  if (!window || (window.from === null && window.to === null)) return null;
  return {from: window.from, to: window.to};
}

/** Captures what the Places host holds into a named view. The record keeps refs and presentation only. */
export function capturePlaceView(input: {
  viewState: PlaceViewState;
  filter: PlaceFilterState;
  stack: BasemapStack;
  window: {from: string | null; to: string | null} | null;
}): PlaceViewRecord {
  const camera = boundedCamera(withCameraDefaults(input.viewState));
  return {
    viewport: placeRecordFromViewState(camera),
    ...layersRecordOf(input.filter, input.stack),
    window: timeWindowRecordOf(input.window),
  };
}

/** What restoring a view sets: the camera, the presentation filter, the basemap rows and the shared window. Never the live-source allowance. */
export interface PlaceViewRestorePlan {
  viewState: PlaceViewState;
  filter: PlaceFilterState;
  stack: BasemapStack;
  window: PlaceTimeWindowRecord | null;
}

export function restorePlaceView(view: PlaceViewRecord): PlaceViewRestorePlan {
  return {
    viewState: viewStateFromPlaceRecord(view.viewport) ?? defaultPlaceView(),
    filter: filterFromLayersRecord(view),
    stack: basemapFromRecord(view.basemap),
    window: timeWindowRecordOf(view.window),
  };
}

/** Whether two shared windows name the same bounds (the restore writes the window only when it differs). */
export function sameTimeWindow(a: {from: string | null; to: string | null} | null, b: {from: string | null; to: string | null} | null): boolean {
  const left = timeWindowRecordOf(a);
  const right = timeWindowRecordOf(b);
  if (left === null || right === null) return left === right;
  return left.from === right.from && left.to === right.to;
}
