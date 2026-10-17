// What the atlas binds for Places while it stands (T-PLACES-ONTO-ATLAS; FOUNDATION §4 "Places is the Archetypal-Earth atlas, alone").
// Called once by the attach (AtlasProjectionPanel.tsx), released with it. It adds no chrome to the pane: everything it does is a
// stage gesture or a reading the M4 plate shows.
//
// - The shared spatial focus turns the Earth (lane-2 T21 "Show on the globe", lane-4 T24 focus reopen; ported from the frame map's
//   focus latch, psychogeographic/PsychogeographicMap.tsx:584, over desktop/cradle/src/techne/m0m5/place/register.ts
//   placeFocusFromSession's law): when the session's `spatial_focus_ref` names a place the world holds, the Earth selects the subject
//   that declares it there, or flies to the point at the atlas's own framing distance for its precision (app/controller.ts frames a
//   place at 2.25 globe radii and a region at 2.6). A ref the world does not hold turns nothing, and is not an error.
// - The camera's scale, for the plate's head (system · body · region; palace while one is entered, palaces/palaceSession.ts), read on the
//   globe's own frame and published only on change.
// - The Place tool's click (placeTool.ts): while it is armed, the point under a click on the globe is read through the atlas's own
//   surface maths (globe/zoom.ts surfacePointAt, data/geo.ts latLonFromDir) — the click itself stays the globe's.
// - The Place tool's owner (placeTool.ts PlaceOwner): the draft is offered to the subject's time-and-place editor
//   (WikiFactsEditor.tsx offerConstellationRoute); the subject is opened where that editor stands (the Graph and source surface,
//   `oi:epi-open-knowledge`, panels/knowledge.tsx); after the owner saves, the world is read again and the subject's occurrence is
//   redrawn in place through the atlas's seam (mount.ts replaceOccurrence), or the reason it could not be is said.

import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types';
import type {DisclosureSessionStore} from '../../../../../../../desktop/cradle/src/techne/session';
import type {AtlasHandle} from '../mount';
import {surfacePointAt} from '../src/globe/zoom';
import {latLonFromDir} from '../src/data/geo';
import {listen} from '../src/ui/lifetime';
import type {SuitePlace} from '../provider/suiteStanding';
import {suitePlaces} from '../provider/suiteStanding';
import {atlasScaleOf, type AtlasScale} from './placesModel';
import {bindPlaceOwner, notePlaceTool, placeAnswered, placeAt, placeToolState, subscribePlaceTool, type PlaceOwner, type PlaceToolSubject} from './placeTool';
import {palaceState} from '../palaces/palaceSession';

// ── the camera's scale ────────────────────────────────────────────────────

let scale: AtlasScale | null = null;
const scaleListeners = new Set<() => void>();

/** The scale the mounted atlas stands at, or null while none is mounted. */
export function atlasScale(): AtlasScale | null {
  return scale;
}

export function subscribeAtlasScale(listener: () => void): () => void {
  scaleListeners.add(listener);
  return () => { scaleListeners.delete(listener) };
}

function publishScale(next: AtlasScale | null): void {
  if (next === scale) return;
  scale = next;
  for (const listener of [...scaleListeners]) listener();
}

// ── the shared spatial focus ──────────────────────────────────────────────

/** The atlas's own framing distance for a place's precision (app/controller.ts:2426: a place 2.25, a region 2.6). */
export function framingDistance(precision: SuitePlace['precision']): number {
  return precision === 'exact' ? 2.25 : 2.6;
}

/** How the Earth turns to a place: the subject's occurrence when the Earth draws it at that very point (it is then selected), else a
 * flight to the point; null when the place is not one the world holds or has no point. Pure. */
export function turnToPlace(place: SuitePlace | undefined, occurrences: readonly {id: string; subject_ref?: string; lat: number; lon: number; geoPrecision: string}[]):
  {kind: 'select'; occId: string} | {kind: 'fly'; lat: number; lon: number; dist: number} | null {
  if (!place || !place.located || place.lat === undefined || place.lon === undefined) return null;
  const drawn = place.subject_ref ? occurrences.find(item => item.subject_ref === place.subject_ref && item.geoPrecision !== 'none'
    && Math.abs(item.lat - place.lat!) < 1e-9 && Math.abs(item.lon - place.lon!) < 1e-9) : undefined;
  if (drawn) return {kind: 'select', occId: drawn.id};
  return {kind: 'fly', lat: place.lat, lon: place.lon, dist: framingDistance(place.precision)};
}

/** Turn the mounted Earth to a place of the world: select the subject the Earth draws there, else fly to the point (not from the sky
 * or the Graph, where the camera does not orbit the Earth). False when the place has no point the Earth can turn to. */
export function turnAtlasTo(handle: AtlasHandle, place: SuitePlace | undefined): boolean {
  const turn = turnToPlace(place, handle.model.occ);
  if (!turn) return false;
  if (turn.kind === 'select') {
    const index = handle.model.occIndex.get(turn.occId);
    if (index === undefined) return false;
    handle.ctl.navigate({view: {kind: 'manifest', occId: turn.occId, context: {type: 'family', id: handle.model.occ[index].familyId}}, deep: false,
      ...(handle.ctl.state.graph ? {graph: true as const} : {})});
    return true;
  }
  if (handle.ctl.state.sky || handle.ctl.state.graph) return false;
  handle.engine.rig.flyTo(turn.lat, turn.lon, turn.dist);
  return true;
}

function followSpatialFocus(handle: AtlasHandle, session: DisclosureSessionStore): () => void {
  // The focus standing when the Earth mounts is honoured once (T24: the Earth opens on the place the session names).
  let seen: string | null | undefined;
  const sync = () => {
    const ref = session.get()?.spatial_focus_ref ?? null;
    if (ref === seen) return;
    seen = ref;
    if (ref) turnAtlasTo(handle, suitePlaces().find(place => place.ref === ref));
  };
  const off = session.subscribe(sync);
  sync();
  return off;
}

// ── the Place tool's point under a click ──────────────────────────────────

/** The longest press, and the furthest travel, that is still a click rather than a drag of the globe (the frame map's long-press band,
 * placeAuthoring.ts LONG_PRESS_MS / LONG_PRESS_SLOP_PX). */
const CLICK_MS = 500;
const CLICK_SLOP_PX = 10;

/** The point on the Earth under a client position, read through the atlas's own surface maths; null off the globe, in the sky or in
 * the Graph (where the camera does not look at the Earth from its orbit). */
export function pointUnder(handle: AtlasHandle, clientX: number, clientY: number): {lat: number; lon: number} | null {
  if (handle.ctl.state.sky || handle.ctl.state.graph) return null;
  const {rig, camera, renderer} = handle.engine;
  const box = renderer.domElement.getBoundingClientRect();
  const nx = ((clientX - box.left) / Math.max(box.width, 1)) * 2 - 1;
  const ny = 1 - ((clientY - box.top) / Math.max(box.height, 1)) * 2;
  const hit = surfacePointAt({lat: rig.lat, lon: rig.lon, dist: rig.dist}, {fovDeg: camera.fov, aspect: camera.aspect, shiftX: rig.shiftX, shiftY: rig.shiftY}, nx, ny);
  return hit ? latLonFromDir(hit) : null;
}

function capturePlaceClicks(handle: AtlasHandle): () => void {
  const canvas = handle.engine.renderer.domElement;
  let down: {x: number; y: number; at: number} | null = null;
  const onDown = (event: PointerEvent) => { down = placeToolState().phase === 'armed' ? {x: event.clientX, y: event.clientY, at: performance.now()} : null };
  const onUp = (event: PointerEvent) => {
    const start = down;
    down = null;
    if (!start || placeToolState().phase !== 'armed') return;
    if (performance.now() - start.at > CLICK_MS || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    placeAt(pointUnder(handle, event.clientX, event.clientY));
  };
  // through the atlas lifetime (ui/lifetime.ts), as every listener the atlas installs: released with it
  const offDown = listen<PointerEvent>(canvas, 'pointerdown', onDown, true);
  const offUp = listen<PointerEvent>(canvas, 'pointerup', onUp, true);
  // the globe says the tool is armed by its pointer, nothing drawn over it (atlasHost.css)
  const mark = () => { if (canvas.dataset) canvas.dataset.placing = placeToolState().phase === 'armed' ? 'true' : 'false' };
  const offMark = subscribePlaceTool(mark);
  mark();
  return () => {
    offMark();
    if (canvas.dataset) delete canvas.dataset.placing;
    offDown();
    offUp();
  };
}

// ── the Place tool's owner ────────────────────────────────────────────────

/** The world read again after the owner saved: the standing (the plate's Locations) is published by the read itself, and the subject's
 * occurrence is redrawn in place. Resolves to what the plate says when the Earth could not redraw it in place. */
async function redrawSubject(handle: AtlasHandle, transport: KernelTransportStatus, subjectRef: string): Promise<string | null> {
  const {suiteProvider} = await import('../provider/suiteProvider');
  const bundle = await suiteProvider(transport).load();
  const fresh = bundle.field.occurrences.find(item => item.subject_ref === subjectRef);
  const held = handle.model.occ.find(item => item.subject_ref === subjectRef);
  if (!fresh || !held) return 'The Earth draws it when it is next read.';
  const family = bundle.field.families.find(item => item.id === fresh.familyId);
  try {
    handle.replaceOccurrence({...fresh, id: held.id}, held.id, family);
    return null;
  } catch (error) {
    return `The Earth draws it when it is next read (${error instanceof Error ? error.message : String(error)}).`;
  }
}

function placeOwner(handle: AtlasHandle, transport: KernelTransportStatus, said: (text: string) => void): PlaceOwner {
  return {
    offer: (subjectRef, draft) => {
      // the owner's editor module is loaded with the Graph and source surface; the offer waits for it, and a failure is said
      void import('../../../../../../../desktop/cradle/src/knowledge/WikiFactsEditor').then(
        editor => editor.offerConstellationRoute(subjectRef, draft),
        error => said(`The time-and-place editor could not be reached: ${error instanceof Error ? error.message : String(error)}`),
      );
    },
    open: (subject: PlaceToolSubject) => {
      window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: {title: subject.title, address: {kind: 'wiki', value: subject.ref}, plane: 'page',
        complete: (error?: string) => { if (error) said(error) }}}));
    },
    reread: subjectRef => {
      void redrawSubject(handle, transport, subjectRef).then(line => { if (line) said(line) }, error => said(error instanceof Error ? error.message : String(error)));
    },
  };
}

// ── the binding ───────────────────────────────────────────────────────────

export interface PlacesBinding {
  dispose(): void;
}

/** Bind Places to the mounted atlas: the shared spatial focus, the camera's scale, the Place tool's click and its owner. What the
 * owner calls answer outside the tool's own states is said on the plate (placeTool.ts notePlaceTool). */
export function bindPlaces({handle, transport, session, said = notePlaceTool}: {handle: AtlasHandle; transport: KernelTransportStatus; session: DisclosureSessionStore; said?: (text: string) => void}): PlacesBinding {
  let live = true;
  handle.engine.onFrame(() => {
    if (!live) return;
    publishScale(atlasScaleOf({sky: !!handle.ctl.state.sky, graph: !!handle.ctl.state.graph, dist: handle.engine.rig.dist, palace: palaceState().phase === 'inside'}));
  });
  const offFocus = followSpatialFocus(handle, session);
  const offClicks = capturePlaceClicks(handle);
  bindPlaceOwner(placeOwner(handle, transport, said));
  // The owner's answer is listened for only while a draft stands offered (through the atlas lifetime, released with it).
  const answered = (event: Event) => placeAnswered((event as CustomEvent).detail ?? {});
  let offAnswers: (() => void) | null = null;
  const watchAnswers = () => {
    const offered = placeToolState().phase === 'offered';
    if (offered && !offAnswers) offAnswers = listen(window, 'oi:constellation-result', answered);
    else if (!offered && offAnswers) { offAnswers(); offAnswers = null; }
  };
  const offWatch = subscribePlaceTool(watchAnswers);
  watchAnswers();
  return {
    dispose() {
      if (!live) return;
      live = false;
      offFocus();
      offClicks();
      offWatch();
      offAnswers?.();
      offAnswers = null;
      bindPlaceOwner(null);
      publishScale(null);
    },
  };
}
