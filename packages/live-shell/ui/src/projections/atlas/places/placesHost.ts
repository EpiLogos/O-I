// What the atlas binds for Places while it stands (T-PLACES-ONTO-ATLAS; FOUNDATION §4 "Places is the Archetypal-Earth atlas, alone").
// Called once by the attach (AtlasProjectionPanel.tsx), released with it. It adds no chrome to the pane: everything it does is a
// stage gesture or a reading the M4 plate shows.
//
// - The shared spatial focus turns the Earth (lane-2 T21 "Show on the globe", lane-4 T24 focus reopen; ported from the frame map's
//   focus latch, psychogeographic/PsychogeographicMap.tsx:584, over desktop/cradle/src/techne/m0m5/place/register.ts
//   placeFocusFromSession's law): when the session's `spatial_focus_ref` names a place the world holds, the Earth selects the subject
//   that declares it there, or flies to the point at the atlas's own framing distance for its precision (app/controller.ts frames a
//   place at 2.25 globe radii and a region at 2.6). A ref the world does not hold turns nothing, and is not an error.
// - The camera's scale, for the plate's head (the manual's: system · body · region · place, a palace entered being a place you are in,
//   palaces/palaceSession.ts; the field is the shared field's, never reached here), read on the globe's own frame and published only on change.
// - The Place tool's click (placeTool.ts): while it is armed, the point under a click on the globe is read through the atlas's own
//   surface maths (globe/zoom.ts surfacePointAt, data/geo.ts latLonFromDir) — the click itself stays the globe's.
// - A place the World turns to (turnAtlasTo, the one door every "fly to a place" goes through) is a place you visit: while Record runs it is
//   a stop of the walk (O-I #760, walks/walkSession.ts noteWalkVisit), with the camera the turn frames it at, and the subject it selects
//   there as the thing visited.
// - The Place tool's owner (placeTool.ts PlaceOwner): the draft is offered to the subject's time-and-place editor
//   (WikiFactsEditor.tsx offerConstellationRoute); the subject is opened where that editor stands (the Graph and source surface,
//   `oi:epi-open-knowledge`, panels/knowledge.tsx); after the owner saves, the world is read again and the subject's occurrence is
//   redrawn in place through the atlas's seam (mount.ts replaceOccurrence), or the reason it could not be is said.

import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types';
import type {DisclosureSessionStore} from '../../../../../../../desktop/cradle/src/techne/session';
import type {AtlasHandle} from '../mount';
import {surfacePointAt} from '../src/globe/zoom';
import {latLonFromDir} from '../src/data/geo';
import {later as lifetimeLater, listen, type Cancel} from '../src/ui/lifetime';
import {WORLD} from '../src/state/store';
import type {SuitePlace} from '../provider/suiteStanding';
import {suitePlaces} from '../provider/suiteStanding';
import {atlasScaleOf, type AtlasScale} from './placesModel';
import {bindPlaceOwner, notePlaceTool, placeAnswered, placeAt, placeToolState, subscribePlaceTool, type DrawnBody, type PlaceOwner, type PlaceToolSubject} from './placeTool';
import {palaceState} from '../palaces/palaceSession';
import {shownBody} from '../body/worldBody';
import {systemActs, systemBodies} from '../system/systemStore';
import {noteWalkVisit} from '../walks/walkSession';

/** The body the globe draws under a click: your world's body while it is shown, else null (the Earth). */
export function drawnBody(): DrawnBody | null {
  const body = shownBody();
  return body ? {body_ref: body.body_ref, seed: body.seed} : null;
}

/** Whether the tool takes the next click on the globe: armed to place, or to land a world. */
const takesClick = (): boolean => placeToolState().phase === 'armed' || placeToolState().phase === 'landing';

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

/** The atlas's own framing distances, in globe radii, one for each precision a flight ends at (manual §17.2: "An exact place gets a street, an
 * approximate place gets a city, and a region gets the whole region"). The street and the whole region are the atlas's own (app/controller.ts
 * frames a place at 2.25 and a region at 2.6); a city stands between them. All three are within the Region scale (placesModel.ts REGION_DISTANCE),
 * and the street is within the Place scale (PLACE_DISTANCE). */
const FRAMING = {exact: 2.25, approximate: 2.4, region: 2.6} as const;

/** The distance a flight to a place ends at, for its precision (a place with no coordinate does not fly: the widest). */
export function framingDistance(precision: SuitePlace['precision']): number {
  return precision === 'exact' || precision === 'approximate' ? FRAMING[precision] : FRAMING.region;
}

/** How the globe turns to a place: the subject's occurrence when the Earth draws it at that very point (it is then selected), else a flight to
 * the point; null when the place is not one the world holds or has no point here. A place on a body other than the Earth (the facet's body_ref,
 * its point in `on_body`) has its point on that body: with that body drawn (`on`) it is flown to there; on any other it has none. Pure. */
export function turnToPlace(place: SuitePlace | undefined, occurrences: readonly {id: string; subject_ref?: string; lat: number; lon: number; geoPrecision: string}[], on: DrawnBody | null = null):
  {kind: 'select'; occId: string} | {kind: 'fly'; lat: number; lon: number; dist: number} | null {
  if (place?.body_ref) {
    return on?.body_ref === place.body_ref && place.on_body ? {kind: 'fly', lat: place.on_body.lat, lon: place.on_body.lon, dist: framingDistance(place.precision)} : null;
  }
  if (!place || !place.located || place.lat === undefined || place.lon === undefined) return null;
  const drawn = place.subject_ref ? occurrences.find(item => item.subject_ref === place.subject_ref && item.geoPrecision !== 'none'
    && Math.abs(item.lat - place.lat!) < 1e-9 && Math.abs(item.lon - place.lon!) < 1e-9) : undefined;
  if (drawn) return {kind: 'select', occId: drawn.id};
  return {kind: 'fly', lat: place.lat, lon: place.lon, dist: framingDistance(place.precision)};
}

/** How often a flight that waits for the sky's descent asks whether the descent has finished, and the most it waits: a descent that never reports
 * done (the camera released under it) must not hold a flight forever, so after the limit the flight goes anyway. The sky camera's own descent
 * is 3.2 s of drop and 1.9 s of landing (sky/camera.ts T.drop, T.land), about five seconds measured against the 2.5 s this once guessed. */
export const LANDING_POLL_MS = 100;
export const LANDING_LIMIT_MS = 12000;

let waitingFlight: Cancel | null = null;

/** Run `fly` once nothing holds the camera. The only thing that does is the sky camera's descent (controller.skyCam.busy: "true from the first
 * frame of a request to its last callback"), which owns the rig while it runs (app/controller.ts descendFromSky); the Graph's switch does not
 * touch the camera. A newer turn replaces an older one still waiting. */
function whenCameraFree(handle: AtlasHandle, fly: () => void, later: (run: () => void, ms: number) => Cancel): void {
  waitingFlight?.();
  waitingFlight = null;
  let waited = 0;
  const check = () => {
    waitingFlight = null;
    if (!handle.ctl.skyCam?.busy || waited >= LANDING_LIMIT_MS) { fly(); return; }
    waited += LANDING_POLL_MS;
    waitingFlight = later(check, LANDING_POLL_MS);
  };
  check();
}

/** Turn the mounted atlas to a place of the world, from wherever it is (manual §17.2: "Fly to a place from anywhere"): select the subject the
 * Earth draws there, else fly to the point. From the sky or the Graph the atlas returns to the Earth first (the controller's own way: the plain
 * world view, or the switch out of the Graph). Leaving the Graph frees the camera at once (measured: the globe wakes and a flight issued in the
 * same breath moves from the first frame); leaving the sky starts the sky camera's descent, which owns the camera until it reports done, and the
 * flight follows that signal. `later` is a timer under the atlas lifetime. False when the place has no point to turn to. */
export function turnAtlasTo(handle: AtlasHandle, place: SuitePlace | undefined, later: (run: () => void, ms: number) => Cancel = lifetimeLater): boolean {
  const turn = turnToPlace(place, handle.model.occ, drawnBody());
  if (!turn) return false;
  // A place the World turns to is a place you visit: a stop of the walk while Record runs (O-I #760; walks/walkSession.ts).
  const visited = place as SuitePlace;
  const camera = turn.kind === 'fly' ? {lat: turn.lat, lon: turn.lon, dist: turn.dist} : {lat: visited.lat ?? 0, lon: visited.lon ?? 0, dist: framingDistance(visited.precision)};
  if (turn.kind === 'select') {
    const index = handle.model.occIndex.get(turn.occId);
    if (index === undefined) return false;
    handle.ctl.navigate({view: {kind: 'manifest', occId: turn.occId, context: {type: 'family', id: handle.model.occ[index].familyId}}, deep: false,
      ...(handle.ctl.state.graph ? {graph: true as const} : {})});
    // The subject selected there is the thing visited, as the atlas's own notice of the opened occurrence names it (walks/walksHost.ts
    // visitOfManifest): the two notices are one stop.
    noteWalkVisit({placeRef: visited.ref, name: visited.name, camera, thingRef: handle.model.occ[index].subject_ref ?? null});
    return true;
  }
  flyAtlasTo(handle, turn.lat, turn.lon, turn.dist, later);
  noteWalkVisit({placeRef: visited.ref, name: visited.name, camera});
  return true;
}

/** Fly the mounted atlas's camera to a point from wherever it is: from the sky or the Graph it returns to the Earth first, as turnAtlasTo does,
 * and the flight waits for the sky's descent. `ms`, when given, is the flight's length (a recorded walk's stop arrives in its own time). */
export function flyAtlasTo(handle: AtlasHandle, lat: number, lon: number, dist: number, later: (run: () => void, ms: number) => Cancel = lifetimeLater, ms?: number): void {
  const {sky, graph} = handle.ctl.state;
  if (sky) handle.ctl.navigate(WORLD); else if (graph) handle.ctl.toggleMode();
  whenCameraFree(handle, () => ms === undefined ? handle.engine.rig.flyTo(lat, lon, dist) : handle.engine.rig.flyTo(lat, lon, dist, {duration: ms / 1000}), later);
}

/** Select a location of your body: it becomes the shared spatial focus, the place every instrument follows (techne/session.ts setSpatialFocus;
 * Follow keeps the other panes with the place you select). The refusal in words when no session stands to hold the focus; null once selected. */
export function selectLocation(session: DisclosureSessionStore, location: {readonly id: string}): string | null {
  try {
    session.setSpatialFocus(location.id);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
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

/** The point on the Earth under a client position, read through the atlas's own surface maths; null off the globe, in the Graph, or
 * in the sky while its layer stands (its camera moves: the camera does not look at the Earth from its orbit). In the sky lens with no
 * sky layer (the port ships no sky grid, provider/skyProvider.ts) the globe drawn is the one the rig orbits, and your system is drawn
 * only in that lens (system/systemOverlay.ts systemWanted), so a world's landing is clicked there (r20). */
export function pointUnder(handle: AtlasHandle, clientX: number, clientY: number): {lat: number; lon: number} | null {
  if (handle.ctl.state.graph || (handle.ctl.state.sky && handle.engine.sky)) return null;
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
  const onDown = (event: PointerEvent) => { down = takesClick() ? {x: event.clientX, y: event.clientY, at: performance.now()} : null };
  const onUp = (event: PointerEvent) => {
    const start = down;
    down = null;
    if (!start || !takesClick()) return;
    if (performance.now() - start.at > CLICK_MS || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    placeAt(pointUnder(handle, event.clientX, event.clientY), drawnBody());
  };
  // through the atlas lifetime (ui/lifetime.ts), as every listener the atlas installs: released with it
  const offDown = listen<PointerEvent>(canvas, 'pointerdown', onDown, true);
  const offUp = listen<PointerEvent>(canvas, 'pointerup', onUp, true);
  // the globe says the tool is armed by its pointer, nothing drawn over it (atlasHost.css)
  const mark = () => { if (canvas.dataset) canvas.dataset.placing = takesClick() ? 'true' : 'false' };
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
    // a world's landing goes to its own body owner, through the acts your system's readings bind (system/SystemReadings.tsx)
    land: async (target, lat, lon) => {
      const acts = systemActs();
      const body = systemBodies().find(entry => entry.key === target.key);
      if (!acts) throw Error('Your system’s owners are not bound in this pane, so no world can be landed from here.');
      if (!body) throw Error(`${target.name} is no longer in today’s set, so it does not land.`);
      return acts.land(body, lat, lon);
    },
    unland: async target => {
      const acts = systemActs();
      const body = systemBodies().find(entry => entry.key === target.key);
      if (!acts) throw Error('Your system’s owners are not bound in this pane, so no world can be taken off from here.');
      if (!body) throw Error(`${target.name} is no longer in today’s set, so it is not taken off from here.`);
      return acts.unland(body);
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
    publishScale(atlasScaleOf({sky: !!handle.ctl.state.sky, graph: !!handle.ctl.state.graph, dist: handle.engine.rig.dist, palace: palaceState().phase === 'inside',
      placeHeld: handle.ctl.state.view.kind === 'manifest'}));
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
