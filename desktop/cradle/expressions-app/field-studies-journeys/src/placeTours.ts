/** Lane-4 T25–T26 — Places tours, as pure logic (no DOM, no maplibre, no store).
 *
 * A tour is presentation: an ordered list of camera stops. Each stop holds refs and presentation only — the place it
 * names (when that place is disclosed by the reading), the camera, a caption and a hold. A recorded stop carries no
 * temporal, route or dated-place field: a tour never mints a route identity and never claims a date.
 *
 * T26: a stop may carry one journey binding, a pair of refs (`expression_ref`, `scene_ref`). The journey owns beats;
 * this module only records the pointer. Whether the pointer still holds is read from the journey's own beat list
 * (`beats()` in src/techne/m0m5/journey/beats.ts) every time it is shown, so a deleted beat leaves the stop intact and
 * unbound, with no shadow record written anywhere.
 *
 * Laws:
 * - Refs are verbatim strings of at most 1024 UTF-16 units; nothing here mints, re-keys or shortens them.
 * - The camera is the Places viewport record (x = longitude, y = latitude), the same shape a named view keeps.
 * - Every problem is returned as the owner's words, never thrown from a read path.
 */
import {
  placeRecordFromViewState,
  withCameraDefaults,
  type PlaceViewState,
} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/placeNavigation';
import {TOUR_FLIGHT_MS, type PlaceTourRecord, type PlaceTourStop} from './placeTourRecord.js';

// The closed record law lives in placeTourRecord.ts; it is re-exported here so the tour's callers read one module.
export * from './placeTourRecord.js';

function boundedCamera(state:PlaceViewState):PlaceViewState&{pitch:number;bearing:number}{
  const camera=withCameraDefaults(state);
  const inside=camera.longitude>=-180&&camera.longitude<=180;
  const longitude=inside?camera.longitude:((((camera.longitude+180)%360)+360)%360)-180;
  return {...camera,longitude,latitude:Math.min(90,Math.max(-90,camera.latitude))};
}

/** Captures the camera the map shows as one stop. The caption is trimmed; an empty caption is no caption. Callers check the
 * result with placeTourProblem before writing it. */
export function captureTourStop(input:{viewState:PlaceViewState;placeRef:string|null;caption:string|null;holdMs:number}):PlaceTourStop{
 const camera=boundedCamera(input.viewState);
 const viewport=placeRecordFromViewState(camera);
 const caption=input.caption===null?null:input.caption.trim();
 return {
  place_ref:input.placeRef,
  viewport:{...viewport,pitch:camera.pitch,bearing:camera.bearing},
  caption:caption?caption:null,
  hold_ms:input.holdMs,
 };
}

/** One stop on the playback timeline: the camera it flies to, what it holds on and what it says. Times are milliseconds from the start. */
export interface PlaceTourStep {
  index:number;
  camera:{latitude:number;longitude:number;zoom:number;pitch:number;bearing:number};
  placeRef:string|null;
  caption:string|null;
  holdMs:number;
  startMs:number;
  arriveMs:number;
  endMs:number;
}

/** The playback timeline: each stop flies (the flight time, zero under reduced motion), then holds. Every stop plays, in order. */
export function placeTourSteps(tour:PlaceTourRecord,options:{reducedMotion?:boolean}={}):{steps:PlaceTourStep[];totalMs:number}{
 const flightMs=options.reducedMotion?0:TOUR_FLIGHT_MS;
 let cursor=0;
 const steps=tour.stops.map((stop,index)=>{
  const camera=withCameraDefaults({latitude:stop.viewport.y,longitude:stop.viewport.x,zoom:stop.viewport.zoom,pitch:stop.viewport.pitch,bearing:stop.viewport.bearing});
  const startMs=cursor;
  const arriveMs=startMs+flightMs;
  const endMs=arriveMs+stop.hold_ms;
  cursor=endMs;
  return {index,camera:{latitude:camera.latitude,longitude:camera.longitude,zoom:camera.zoom,pitch:camera.pitch,bearing:camera.bearing},placeRef:stop.place_ref,caption:stop.caption,holdMs:stop.hold_ms,startMs,arriveMs,endMs};
 });
 return {steps,totalMs:cursor};
}
