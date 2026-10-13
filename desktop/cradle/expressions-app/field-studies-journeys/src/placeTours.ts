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
  type PlaceViewportRecord,
} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/placeNavigation';

/** The bounds a tour admits. The native material, when it holds tours, mirrors these numbers. */
export const TOUR_LIMIT=16;
export const TOUR_STOP_LIMIT=32;
export const TOUR_CAPTION_MAX=280;
export const TOUR_HOLD_MAX_MS=60000;
export const TOUR_NAME_MAX=160;
export const TOUR_REF_MAX=1024;
/** The flight between two stops, by its own duration (the map eases it). Reduced motion removes it. */
export const TOUR_FLIGHT_MS=1800;

/** Names that collide with the record's own machinery (a JavaScript object): never a tour name. */
const RESERVED_TOUR_NAMES=new Set(['__proto__','constructor','prototype']);

/** A journey binding: the journey's own beat identity, verbatim. */
export interface PlaceTourBinding {expression_ref:string;scene_ref:string}

/** One stop. `place_ref` is null when the camera names no disclosed place. `binding` is absent when no journey holds the stop. */
export interface PlaceTourStop {
  place_ref:string|null;
  viewport:PlaceViewportRecord & {pitch:number;bearing:number};
  caption:string|null;
  hold_ms:number;
  binding?:PlaceTourBinding;
}

/** A tour: an ordered, bounded list of stops. */
export interface PlaceTourRecord {stops:PlaceTourStop[]}

const STOP_KEYS=['place_ref','viewport','caption','hold_ms','binding'];
const VIEWPORT_KEYS=['x','y','zoom','pitch','bearing'];
const BINDING_KEYS=['expression_ref','scene_ref'];

function ref(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=TOUR_REF_MAX;}
function finiteIn(value:unknown,low:number,high:number):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>=low&&value<=high;}
function onlyKeys(value:Record<string,unknown>,allowed:readonly string[]):boolean{return Object.keys(value).every(key=>allowed.includes(key));}
function isObject(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}

/** The name rule for a tour kept under a name: non-blank, bounded, not a reserved word, and a new name only while the Scene has room. */
export function placeTourNameProblem(name:string,existing:Readonly<Record<string,unknown>>):string|null{
  const trimmed=name.trim();
  if(!trimmed)return 'Name the tour first.';
  if(trimmed.length>TOUR_NAME_MAX)return `A tour name is at most ${TOUR_NAME_MAX} characters.`;
  if(RESERVED_TOUR_NAMES.has(trimmed))return 'That name is reserved; choose another.';
  if(!Object.hasOwn(existing,trimmed)&&Object.keys(existing).length>=TOUR_LIMIT)return `A Scene keeps at most ${TOUR_LIMIT} tours. Remove one before recording another.`;
  return null;
}

/** The reason a tour cannot be kept, in the owner's words; null when it is a closed, bounded tour. */
export function placeTourProblem(value:unknown):string|null{
  if(!isObject(value)||!onlyKeys(value,['stops']))return 'A tour is a list of stops.';
  const stops=value.stops;
  if(!Array.isArray(stops))return 'A tour is a list of stops.';
  if(stops.length===0)return 'A tour needs at least one stop.';
  if(stops.length>TOUR_STOP_LIMIT)return `A tour holds at most ${TOUR_STOP_LIMIT} stops.`;
  for(const [index,stop] of stops.entries()){
    const at=`Stop ${index+1}`;
    if(!isObject(stop)||!onlyKeys(stop,STOP_KEYS))return `${at} carries a field a tour stop does not keep.`;
    if(stop.place_ref!==null&&!ref(stop.place_ref))return `${at} names a place ref that is not a ref.`;
    const viewport=stop.viewport;
    if(!isObject(viewport)||!onlyKeys(viewport,VIEWPORT_KEYS))return `${at} viewport is not a camera.`;
    if(!finiteIn(viewport.x,-180,180)||!finiteIn(viewport.y,-90,90)||!finiteIn(viewport.zoom,0.001,1e5))return `${at} viewport is outside the globe or its zoom bound.`;
    if(!finiteIn(viewport.pitch??0,0,85)||!finiteIn(viewport.bearing??0,-180,180))return `${at} viewport pitch or bearing is outside its bound.`;
    if(stop.caption!==null&&(typeof stop.caption!=='string'||stop.caption.length>TOUR_CAPTION_MAX))return `${at} caption is at most ${TOUR_CAPTION_MAX} characters.`;
    if(!Number.isInteger(stop.hold_ms)||!finiteIn(stop.hold_ms,0,TOUR_HOLD_MAX_MS))return `${at} hold is between 0 and ${TOUR_HOLD_MAX_MS} ms.`;
    if(stop.binding!==undefined){
     const binding=stop.binding;
     if(!isObject(binding)||!onlyKeys(binding,BINDING_KEYS)||!ref(binding.expression_ref)||!ref(binding.scene_ref))return `${at} journey binding is not a pair of refs.`;
    }
  }
  return null;
}

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

/** The tour with one stop added at the end. Returns the new record, or the refusal in the owner's words. */
export function appendTourStop(tour:PlaceTourRecord,stop:PlaceTourStop):{record:PlaceTourRecord;problem:string|null}{
 const record={stops:[...tour.stops,stop]};
 const problem=placeTourProblem(record);
 return problem?{record:tour,problem}:{record,problem:null};
}

/** The tour with one stop removed. The rest keep their order and their bytes. */
export function removeTourStop(tour:PlaceTourRecord,index:number):PlaceTourRecord{
 return {stops:tour.stops.filter((_,at)=>at!==index)};
}

/** The tour with one stop's journey binding set, or cleared. A cleared stop has no binding key at all. Other stops are the same objects. */
export function withStopBinding(tour:PlaceTourRecord,index:number,binding:PlaceTourBinding|null):PlaceTourRecord{
 return {stops:tour.stops.map((stop,at)=>{
  if(at!==index)return stop;
  const {binding:_previous,...rest}=stop;
  return binding===null?rest:{...rest,binding:{expression_ref:binding.expression_ref,scene_ref:binding.scene_ref}};
 })};
}

/** One stop's binding as the journey reads it now. `none`: no binding. `bound`: the journey holds that beat. `unbound`: the
 * stop names a beat the journey no longer holds; the stop itself is untouched and carries the reason. */
export type PlaceTourBindingState=
 | {state:'none';binding:null;reason:null}
 | {state:'bound';binding:PlaceTourBinding;reason:null}
 | {state:'unbound';binding:PlaceTourBinding;reason:string};

/** The journey's beats as the tour reads them: the journey's own beat identity (the beats() read). Pure; the tour is not changed. */
export function resolveTourBindings(tour:PlaceTourRecord,beats:readonly {expression_ref:string;scene_ref:string}[]):PlaceTourBindingState[]{
 return tour.stops.map(stop=>{
  if(!stop.binding)return {state:'none',binding:null,reason:null};
  const held=beats.some(beat=>beat.expression_ref===stop.binding!.expression_ref&&beat.scene_ref===stop.binding!.scene_ref);
  if(held)return {state:'bound',binding:stop.binding,reason:null};
  return {state:'unbound',binding:stop.binding,reason:'The journey no longer holds this beat; the stop stays and is unbound.'};
 });
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
