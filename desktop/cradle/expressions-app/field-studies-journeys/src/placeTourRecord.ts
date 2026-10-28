/** Lane-4 T25–T26 — the closed record law of a Places tour, as pure logic with no camera maths and no vendor imports.
 *
 * The Scene's material validator (researchMaterial.ts) admits a tour through this module, so it must stay free of the
 * map's modules: a material check cannot pull the map's own import graph into every build that reads the Scene.
 * The camera capture and the playback timeline live in placeTours.ts, which re-exports this module.
 *
 * Laws: refs are verbatim strings of at most 1024 UTF-16 units; a recorded stop carries no route, no dated-place field and no
 * temporal field but its moment; a journey binding is a pair of refs that the journey's own beat list decides on, never a copy.
 *
 * O-I #760 (manual §17.1 Takes, "each place, moment or thing you visit becomes a stop"; §17.6, a Journey's stop has "a place, a moment,
 * a scene and a few words"): a stop may keep the moment it was made at — a window in the shared window's own shape ({from, to}, each
 * a string of at most 64 UTF-16 units or null, at least one edge named; techne/contract.ts DisclosureSession.time_window) — and the
 * thing it visited, by its owner's ref. Absent is none: a moment or a thing is never null. The kernel admits the same
 * (kernel/src/expression_scene.rs place_tour_stop); tests/place-material-parity.test.mjs holds the two to one case list.
 */
/** The bounds a tour admits. The native material, when it holds tours, mirrors these numbers. */
export const TOUR_LIMIT=16;
export const TOUR_STOP_LIMIT=32;
export const TOUR_CAPTION_MAX=280;
export const TOUR_HOLD_MAX_MS=60000;
export const TOUR_NAME_MAX=160;
export const TOUR_REF_MAX=1024;
/** A moment's edge: a timestamp as the shared window holds one, at most this many UTF-16 units (the window's own bound). */
export const TOUR_MOMENT_EDGE_MAX=64;
/** The flight between two stops, by its own duration (the map eases it). Reduced motion removes it. */
export const TOUR_FLIGHT_MS=1800;

/** Names that collide with the record's own machinery (a JavaScript object): never a tour name. */
const RESERVED_TOUR_NAMES=new Set(['__proto__','constructor','prototype']);

/** A journey binding: the journey's own beat identity, verbatim. */
export interface PlaceTourBinding {expression_ref:string;scene_ref:string}

/** A stop's moment: a window in the shared window's shape. One edge may be open (null); not both. */
export interface PlaceTourMoment {from:string|null;to:string|null}

/** One stop. `place_ref` is null when the camera names no disclosed place. `binding` is absent when no journey holds the stop.
 * `moment` is absent when the stop keeps no time; `thing_ref` is absent when it visited no thing. */
export interface PlaceTourStop {
  place_ref:string|null;
  viewport:{x:number;y:number;zoom:number;pitch:number;bearing:number};
  caption:string|null;
  hold_ms:number;
  binding?:PlaceTourBinding;
  moment?:PlaceTourMoment;
  thing_ref?:string;
}

/** A tour: an ordered, bounded list of stops. */
export interface PlaceTourRecord {stops:PlaceTourStop[]}

const STOP_KEYS=['place_ref','viewport','caption','hold_ms','binding','moment','thing_ref'];
const MOMENT_KEYS=['from','to'];
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
    if(stop.moment!==undefined&&!placeTourMoment(stop.moment))return `${at} moment is not a window: a from and a to, each a time of at most ${TOUR_MOMENT_EDGE_MAX} characters or open, and not both open.`;
    if(stop.thing_ref!==undefined&&!ref(stop.thing_ref))return `${at} names a thing that is not a ref.`;
  }
  return null;
}

/** A stop's moment as the law admits it: closed, both edges present, each a bounded string or null, and at least one named. */
export function placeTourMoment(value:unknown):value is PlaceTourMoment{
 if(!isObject(value)||!onlyKeys(value,MOMENT_KEYS)||!MOMENT_KEYS.every(key=>Object.hasOwn(value,key)))return false;
 const edge=(bound:unknown)=>bound===null||typeof bound==='string'&&bound.length<=TOUR_MOMENT_EDGE_MAX;
 return edge(value.from)&&edge(value.to)&&(value.from!==null||value.to!==null);
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
  return {state:'unbound',binding:stop.binding,reason:'The journey no longer holds this beat. The stop stays, and its binding stays on the record until you choose Not bound.'};
 });
}
