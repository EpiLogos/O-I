/** Local research presentation of the SAME native Scene. Canonical source
 * bodies/relations are never edited by these material actions. */
import {clone,entity,uid,type Scene} from './model.js';
import type {ViewBasis} from './viewDrift.js';
import {validateConnector,CONNECTOR_KEY_MAX,CONNECTOR_RECORD_MAX,type ResearchConnector} from './canvasConnectors.js';
import {CANVAS_OBJECT_KINDS,CANVAS_TOOL_SPEC,STICKY_DEFAULT_PALETTE,isCanvasObjectKind,isPaletteKey,isShapeFill,isShapeGeometry,type CanvasObjectKind,type CanvasToolChoice,type PaletteKey,type ShapeFill,type ShapeGeometry} from './canvasShapes.js';
import {EMBED_CARD_SIZE,MEDIA_CARD_SIZE,embedHost,embedUrlRecord,isCentralPathRef,mediaFileName,type CentralPathRef} from './canvasEmbeds.js';
import {FRAME_TITLE_MAX,frameTitleRecord} from './canvasFrames.js';
import {LIVE_BASEMAP_SOURCES,OFFLINE_GROUND_ID} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/basemapSources';
import {TIMELINE_CATEGORY_IDS as CATEGORY_IDS} from './timelineCategoryIds';
import {TOUR_LIMIT,placeTourNameProblem,placeTourProblem,type PlaceTourRecord} from './placeTourRecord.js';

/** Card kinds the material admits: the image/note cards, the lane-1 A2 canvas
 * objects (sticky, shape, text) and the lane-1 A10 embed and media cards. */
export type ResearchCardKind='note'|'image'|'embed'|'media'|CanvasObjectKind;
export interface ResearchCard {
 type:ResearchCardKind;
 importedAt?:string; content?:string; caption?:string;
 color?:string; dotColour?:string; bgColour?:string; textColour?:string;
 /** Canvas display size only — never the Expression's own size. A
  * source-bound occurrence keeps its own expressive body regardless of how
  * large or small its card renders on this presentation Canvas. */
 size?:{width:number;height:number};
 /** lane-1 A2 — a sticky's colour KEY (`type:'sticky'` only). */
 palette?:PaletteKey;
 /** lane-1 A2 — a shape's geometry (`type:'shape'` only, required there). */
 shape?:ShapeGeometry;
 /** lane-1 A2 — a shape's fill: 'none' (stroke only, the quiet default) or a palette key (`type:'shape'` only). */
 fill?:ShapeFill;
 /** lane-1 A10 — an embed card's address (`type:'embed'` only, required there): the https URL as typed, never a fetched copy. */
 url?:string;
 /** lane-1 A10 — a media card's reference to a possessed Central file (`type:'media'` only, required there). Bytes are read through the material protocol, never stored here. */
 media?:CentralPathRef;
}
export interface ResearchViewport {x:number;y:number;zoom:number;/** lane-4 T1: a tilted, rotated Places view (absent = untilted, north-up) */pitch?:number;bearing?:number}
export interface ResearchStroke {id:string;points:{x:number;y:number;pressure?:number}[];color:string;width:number;opacity:number;createdAt:string}
/** A presentation-only visual grouping over existing occurrence ids — never
 * a membership/semantic record. `z` orders overlapping frames for drawing
 * (bring-to-front / send-to-back are presentation state, nothing else). */
export interface ResearchFrame {label:string;/** lane-1 A9: the owner's heading, drawn at the frame's top edge; absent = no heading on the stage. The label is never drawn. */title?:string;memberRefs:string[];z:number}
/** A named saved view: camera + the presentation state a person would
 * expect a "view" to restore — which cards were selected and which frame
 * sits on top. Never a second copy of graph material. */
/** D2: the basis a named view was saved against (absent in views saved before it). Closed; both fields are refs. */
export interface ResearchNamedView {viewport:ResearchViewport;selectedRefs:string[];frameOrder:string[];basis?:ViewBasis}
/** lane-4 T20–T21: the Places standing classes a layer can read (the cradle's own vocabulary, placeReading). */
export type PlaceStanding='factual'|'mythic'|'owner-vocabulary';
/** lane-4 T20: the basemap rows as a view or the Scene keeps them. Keys are the basemap registry ids (closed; the kernel holds the same list). Never the owner's live-source allowance. */
export interface PlaceBasemapRecord {terrainVisible:boolean;layers:Record<string,{visible:boolean;opacity:number}>}
/** lane-4 T20–T21: the Places layer toggles and basemap rows. Absent `relations` or `standing` = every layer on; absent `basemap` = the offline ground only. */
export interface PlaceLayersRecord {relations?:string[];standing?:PlaceStanding[];basemap?:PlaceBasemapRecord}
/** lane-4 T20: the shared time window a view restores ({from,to} as the session holds them; null = open). */
export interface PlaceTimeWindowRecord {from:string|null;to:string|null}
/** lane-4 T20: a named Places view — camera, layer toggles, basemap rows and the time window. Refs and presentation only, never a copy of the reading. */
export interface PlaceViewRecord extends PlaceLayersRecord {viewport:{x:number;y:number;zoom:number;pitch?:number;bearing?:number};window:PlaceTimeWindowRecord|null}
/** lane-2 T16: a timeline card's style, in the card-style colour grammar (`#rrggbb` or `#rrggbbaa`). Absent = the category's own colours. */
export interface TimelineCardStyle {dotColour?:string;bgColour?:string;textColour?:string}
/** lane-2 T15: the M2′ chronology (the timeline's own spine) or the relation field. */
export type TimelineProjection='chronology'|'relations';
/** lane-2 T15–T18: a named timeline view — camera, projection, relation links, filters, the followed cause chain, the open
 * sub-timeline frame and the stacked working set. Refs and presentation only: a working-set or frame ref is re-read through
 * the native owner when the view is restored, never a stored copy of the node. */
export interface TimelineViewRecord {
 camera:{centerYear:number;pixelsPerYear:number};
 projection:TimelineProjection;
 /** The relation links drawn over the chronology (the relation mode of the lens). */
 relationLinks:boolean;
 filters:{hiddenCategories:string[];relationTypes:string[]|null;tags:string[]};
 /** The followed cause chain (the walk position); null when none is followed. */
 chainId:string|null;
 /** The open sub-timeline frame (T18); absent = the Earth zero-case. */
 frameNodeId?:string;
 /** The working-set stack, bottom first (T18). At most 64. */
 workingSetRefs:string[];
}
/** lane-2 T15–T18: the bounds a timeline view and a timeline card style admit. The kernel holds the same numbers. */
export const TIMELINE_VIEW_LIMIT=32;
export const TIMELINE_VIEW_REF_LIMIT=64;
export const TIMELINE_REF_MAX=512;
/** Years either side of zero the camera may name (the reading spans deep time to the present). */
export const TIMELINE_CENTER_YEAR_LIMIT=1e10;
/** The camera zoom a view may name: the lens floor (1e-9 px/year) up to a ceiling above the lens's own maximum, which the lens clamps to. */
export const TIMELINE_PIXELS_PER_YEAR_RANGE:readonly [number,number]=[1e-9,1e14];
const TIMELINE_CATEGORY_IDS:readonly string[]=CATEGORY_IDS;
const TIMELINE_STYLE_KEYS:readonly string[]=['dotColour','bgColour','textColour'];
export interface ResearchMaterial {
 schema:'oi.research-scene/v1';cards:Record<string,ResearchCard>;strokes:ResearchStroke[];

 views:Record<string,ResearchViewport>; timeline:Record<string,{offsetY:number;width?:number;height?:number;lane?:string;layoutRevision?:number;/** lane-2 T16: the card's colours (absent = the category's own). */style?:TimelineCardStyle}>;
 frames:Record<string,ResearchFrame>; namedViews:Record<string,ResearchNamedView>;
 /** lane-1 A3–A4: presentation connectors keyed by the native edge id (absent = today's curved auto routing). */
 connectors?:Record<string,ResearchConnector>;
 /** lane-4 T20: named Places views, kept beside the canvas's namedViews (absent = none saved). At most 32. */
 placeViews?:Record<string,PlaceViewRecord>;
 /** lane-4 T21: the Places layer toggles and basemap rows the Scene keeps, written whole (absent = every disclosed layer on, the offline ground only). Never the owner's live-source allowance. */
 placeLayers?:PlaceLayersRecord;
 /** lane-4 T25: named Places tours, kept beside the Places views (absent = none saved). At most 16 tours of 32 stops; each is closed by placeTours.ts. */
 placeTours?:Record<string,PlaceTourRecord>;
 /** lane-2 T15: named timeline views, kept beside the canvas's namedViews (absent = none saved). At most 32. */
 timelineViews?:Record<string,TimelineViewRecord>;
}
export type ResearchMaterialAction =
 | {type:'resize';id:string;width:number;height:number}
 | {type:'duplicate';id:string}
 | {type:'create-card';id?:string;kind:ResearchCard['type'];position:{x:number;y:number};title?:string;dataUrl?:string;geometry?:ShapeGeometry;/** lane-1 A10: an embed card's https address. */url?:string;/** lane-1 A10: a media card's Central file. */media?:CentralPathRef}
 | {type:'card-content';id:string;content:string}
 | {type:'card-caption';id:string;caption:string}
 | {type:'card-style';id:string;patch:Partial<Pick<ResearchCard,'color'|'dotColour'|'bgColour'|'textColour'|'palette'|'fill'>>}
 | {type:'annotation-add';stroke:ResearchStroke}
 | {type:'annotation-remove';id:string}
 | {type:'viewport';key:string;value:ResearchViewport}
 | {type:'timeline-layout';id:string;value:ResearchMaterial['timeline'][string];expectedRevision:number|null}
 | {type:'frame-save';id:string;label:string;memberRefs:string[]}
 | {type:'frame-remove';id:string}
 /** lane-1 A9: the owner's heading for a frame; an empty or blank title removes it (no trace left on the stage). */
 | {type:'frame-title';id:string;title:string}
 | {type:'frame-order';id:string;direction:'front'|'back'}
 | {type:'view-save';name:string;viewport:ResearchViewport;selectedRefs:string[];frameOrder:string[];basis?:ViewBasis}
 | {type:'view-remove';name:string}
 /** lane-4 T20: a named Places view, kept beside the canvas views. Only placeViews changes. */
 | {type:'place-view-save';name:string;place:PlaceViewRecord}
 | {type:'place-view-remove';name:string}
 /** lane-4 T21: the Places layer toggles and basemap rows, written whole. Only placeLayers changes. */
 | {type:'place-layers-set';value:PlaceLayersRecord}
 /** lane-4 T25: a named Places tour, kept beside the Places views. Only placeTours changes. */
 | {type:'place-tour-save';name:string;tour:PlaceTourRecord}
 | {type:'place-tour-remove';name:string}
 /** lane-2 T15: a named timeline view, kept beside the Places and canvas views. Only timelineViews changes. */
 | {type:'timeline-view-save';name:string;view:TimelineViewRecord}
 | {type:'timeline-view-remove';name:string}
 /** B2: several changes made as ONE material change — one working copy, one validation, one commit and one undo step labelled `label`. Atomic: any refused step refuses the whole batch. Never nests. */
 | {type:'batch';label:string;actions:ResearchMaterialAction[]};
const color=(value:unknown)=>typeof value==='string'&&/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
const finite=(v:unknown,low:number,high:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=low&&v<=high;
/** A record key that is a real own key: never one of a JavaScript object's own machinery names. */
const viewNameAllowed=(name:string)=>!['__proto__','constructor','prototype'].includes(name.trim());
const text=(v:unknown,max=4096)=>typeof v==='string'&&v.length<=max;
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function require(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
function keys(value:object,allowed:string[]){require(Object.keys(value).every(key=>allowed.includes(key)),'Unknown research presentation field');}
export function validateResearchContent(content:string):void {
 require(text(content,65536),'Research note exceeds 64 KiB');const blocks:unknown=JSON.parse(content);
 require(Array.isArray(blocks)&&blocks.length<=256,'Research note requires bounded BlockNote blocks');
 const inspect=(v:unknown,depth=0):void=>{
  require(depth<=24,'Research note nesting exceeds its bound');
  if(Array.isArray(v)){require(v.length<=1024,'Research note array exceeds its bound');v.forEach(x=>inspect(x,depth+1));}
  else if(object(v))for(const [key,value] of Object.entries(v)){
   require(!['__proto__','prototype','constructor'].includes(key),'Unsafe note property');
   if(key==='type')require(!['image','video','audio','file'].includes(String(value)),'Insert media through the native image/resource action');
   if(key==='href')require(typeof value==='string'&&/^(https?:|mailto:)/i.test(value),'Unsupported note link');
   if(key==='url')require(!value,'Note media requires a native resource binding');
   inspect(value,depth+1);
  }else require(v===null||typeof v==='boolean'||typeof v==='string'||typeof v==='number'&&Number.isFinite(v),'Invalid note value');
 };inspect(blocks);
}
export function emptyResearchMaterial():ResearchMaterial{return {schema:'oi.research-scene/v1',cards:{},strokes:[],views:{},timeline:{},frames:{},namedViews:{}};}
export function pruneResearchOccurrence(scene:Scene,id:string):void {
 if(!scene.research)return;delete scene.research.cards[id];
 // A removed occurrence can no longer remain frame membership: a frame is
 // presentation state over occurrences that still exist. Saved views are
 // not pruned (B4). Research material
 // saved before frames/named views existed carries neither field.
 const frames=scene.research.frames??={};
 for(const frame of Object.values(frames))frame.memberRefs=frame.memberRefs.filter(ref=>ref!==id);
 for(const key of Object.keys(frames))if(!frames[key].memberRefs.length)delete frames[key];
 // B4: a saved view keeps the refs it held (its tombstones). Applying it reports
 // the departed members (viewDrift) rather than dropping them here silently.
}
/** D2: a named view's basis is closed (subject_ref, binding_ref) and each is a non-empty ref of at most 1024 UTF-16 units — the kernel's grammar. */
export function validateViewBasis(value:unknown):asserts value is ViewBasis{
 require(object(value),'Invalid view basis');keys(value,['subject_ref','binding_ref']);
 require(['subject_ref','binding_ref'].every(key=>typeof value[key]==='string'&&value[key].length>0&&text(value[key],1024)),'Invalid view basis');
}
export function validateResearchMaterial(value:unknown,ids:ReadonlySet<string>):asserts value is ResearchMaterial {
 require(object(value),'Research material must be an object');keys(value,['schema','cards','strokes','views','timeline','frames','namedViews','connectors','placeViews','placeLayers','timelineViews','placeTours']);
 require(value.schema==='oi.research-scene/v1','Unsupported research material');
 require(new TextEncoder().encode(JSON.stringify(value)).length<=262144,'Research material exceeds 256 KiB');
 for(const key of ['cards','views','timeline'])require(object(value[key])&&Object.keys(value[key]).length<=(key==='views'?16:256),'Research record count exceeds its bound');
 // Backward-compatible: research material persisted before frames/named
 // views existed carries neither field. Absent is valid (treated as empty);
 // present is validated strictly like every other record collection.
 if(value.frames!==undefined)require(object(value.frames)&&Object.keys(value.frames).length<=64,'Research frame count exceeds its bound');
 if(value.namedViews!==undefined)require(object(value.namedViews)&&Object.keys(value.namedViews).length<=32,'Research named view count exceeds its bound');
 for(const [,frame] of Object.entries(value.frames??{}) as [string,{label?:unknown;title?:unknown;memberRefs?:unknown;z?:unknown}][]){
  require(object(frame),'Invalid frame');keys(frame,['label','title','memberRefs','z']);
  require(text(frame.label,160)&&!!frame.label,'Invalid frame label');
  // lane-1 A9: a title is absent or a non-blank heading; a blank one is removed, never stored.
  if(frame.title!==undefined)require(text(frame.title,FRAME_TITLE_MAX)&&!!(frame.title as string).trim(),'Invalid frame title');
  require(Array.isArray(frame.memberRefs)&&frame.memberRefs.length>=1&&frame.memberRefs.length<=64&&frame.memberRefs.every(ref=>typeof ref==='string'&&ids.has(ref)),'Invalid frame membership');
  require(Number.isInteger(frame.z),'Invalid frame order');
 }
 for(const [,view] of Object.entries(value.namedViews??{}) as [string,{viewport?:unknown;selectedRefs?:unknown;frameOrder?:unknown;basis?:unknown}][]){
  require(object(view),'Invalid named view');keys(view,['viewport','selectedRefs','frameOrder','basis']);
  if(view.basis!==undefined)validateViewBasis(view.basis);
  validateViewport(view.viewport);
  require(Array.isArray(view.selectedRefs)&&view.selectedRefs.length<=64&&view.selectedRefs.every(ref=>typeof ref==='string'),'Invalid view selection');
  require(Array.isArray(view.frameOrder)&&view.frameOrder.length<=64&&view.frameOrder.every(ref=>typeof ref==='string'),'Invalid view frame order');
 }
 // lane-4 T20: named Places views are absent in material saved before them; present, each is validated closed.
 if(value.placeViews!==undefined)require(object(value.placeViews)&&Object.keys(value.placeViews).length<=PLACE_VIEW_LIMIT,'Place view count exceeds its bound');
 for(const [name,view] of Object.entries(value.placeViews??{})){require(text(name,160)&&!!name.trim(),'Invalid place view name');validatePlaceView(view);}
 // lane-4 T21: the Places layers are absent in material saved before them; present, they are validated closed.
 if(value.placeLayers!==undefined)validatePlaceLayersRecord(value.placeLayers);
 // lane-2 T15: named timeline views are absent in material saved before them; present, each is validated closed.
 if(value.timelineViews!==undefined)require(object(value.timelineViews)&&Object.keys(value.timelineViews).length<=TIMELINE_VIEW_LIMIT,'Timeline view count exceeds its bound');
 for(const [name,view] of Object.entries(value.timelineViews??{})){require(text(name,160)&&!!name.trim(),'Invalid timeline view name');validateTimelineView(view);}
 // lane-4 T25: named Places tours are absent in material saved before them; present, each is validated closed by placeTours.ts.
 if(value.placeTours!==undefined)require(object(value.placeTours)&&Object.keys(value.placeTours).length<=TOUR_LIMIT,'Place tour count exceeds its bound');
 for(const [name,tour] of Object.entries(value.placeTours??{})){require(text(name,160)&&!!name.trim(),'Invalid place tour name');const problem=placeTourProblem(tour);require(problem===null,problem??'');}
 for(const [id,card] of Object.entries(value.cards) as [string,ResearchCard][]){
  require(ids.has(id)&&object(card),'Research card must address an existing occurrence');
  keys(card,['type','importedAt','content','caption','color','dotColour','bgColour','textColour','size','palette','shape','fill','url','media']);
  require(['note','image','embed','media',...CANVAS_OBJECT_KINDS].includes(card.type),'Unknown research card kind');
  // lane-1 A10: an embed carries an https address and a media card a Central path reference; each is admitted only on its own kind.
  require(card.type==='embed'?embedUrlRecord(card.url)===card.url:card.url===undefined,'Invalid embed link');
  require(card.type==='media'?isCentralPathRef(card.media):card.media===undefined,'Invalid media reference');
  // lane-1 A2: a sticky carries a palette KEY (never a colour), a shape a
  // geometry and a fill key; each field is admitted only on its own kind.
  if(card.palette!==undefined)require(card.type==='sticky'&&isPaletteKey(card.palette),'Invalid sticky colour');
  if(card.type==='shape')require(isShapeGeometry(card.shape)&&(card.fill===undefined||isShapeFill(card.fill)),'Invalid shape');
  else require(card.shape===undefined&&card.fill===undefined,'Only shape cards carry a geometry or fill');
  if(card.importedAt!==undefined)require(card.type==='image'&&text(card.importedAt,64)&&Number.isFinite(Date.parse(card.importedAt)),'Invalid image import time');
  if(card.content!==undefined){require(card.type==='note','Only note cards carry note content');validateResearchContent(card.content);}
  for(const key of ['caption'] as const)if(card[key]!==undefined)require(text(card[key]),'Research caption exceeds its bound');
  for(const key of ['color','dotColour','bgColour','textColour'] as const)if(card[key]!==undefined)require(color(card[key]),'Research colour is invalid');
  if(card.size!==undefined){require(object(card.size),'Invalid card display size');keys(card.size,['width','height']);require(finite(card.size.width,40,40000)&&finite(card.size.height,40,40000),'Invalid card display size');}
 }
 // lane-1 A3–A4: absent is valid (material saved before connectors existed); present is validated closed.
 if(value.connectors!==undefined){require(object(value.connectors)&&Object.keys(value.connectors).length<=CONNECTOR_RECORD_MAX,'Connector count exceeds its bound');for(const [edgeId,connector] of Object.entries(value.connectors)){require(text(edgeId,CONNECTOR_KEY_MAX)&&!!edgeId,'Invalid connector edge');validateConnector(connector);}}
 require(Array.isArray(value.strokes)&&value.strokes.length<=128,'Annotation count exceeds its bound');
 const seen=new Set<string>();for(const stroke of value.strokes){require(object(stroke),'Invalid annotation');keys(stroke,['id','points','color','width','opacity','createdAt']);require(text(stroke.id,160)&&!!stroke.id&&!seen.has(stroke.id),'Duplicate annotation');seen.add(stroke.id);require(color(stroke.color)&&finite(stroke.width,.1,100)&&finite(stroke.opacity,0,1)&&text(stroke.createdAt,64)&&Number.isFinite(Date.parse(stroke.createdAt)),'Invalid annotation style');require(Array.isArray(stroke.points)&&stroke.points.length>0&&stroke.points.length<=4096,'Annotation point budget exceeded');for(const p of stroke.points)require(object(p)&&finite(p.x,-40000,40000)&&finite(p.y,-40000,40000)&&(p.pressure===undefined||finite(p.pressure,0,1)),'Invalid annotation point');}
 for(const view of Object.values(value.views))validateViewport(view);
 for(const layout of Object.values(value.timeline) as ResearchMaterial['timeline'][string][]){require(object(layout),'Invalid timeline layout');keys(layout,['offsetY','width','height','lane','layoutRevision','style']);require((layout.lane===undefined||text(layout.lane,1024))&&(layout.layoutRevision===undefined||Number.isSafeInteger(layout.layoutRevision)&&layout.layoutRevision>=1),'Invalid timeline layout revision');require(finite(layout.offsetY,-40000,40000)&&(layout.width===undefined||finite(layout.width,40,40000))&&(layout.height===undefined||finite(layout.height,40,40000)),'Invalid timeline layout');if(layout.style!==undefined)validateTimelineStyle(layout.style);}
}
/** lane-2 T16: a timeline card's colours, in the card-style colour grammar. Closed: only dotColour, bgColour and textColour. */
export function validateTimelineStyle(value:unknown):asserts value is TimelineCardStyle{
 require(object(value),'Invalid timeline style');keys(value,TIMELINE_STYLE_KEYS as string[]);
 for(const key of TIMELINE_STYLE_KEYS)if(value[key]!==undefined)require(color(value[key]),'Timeline colour is invalid');
}
/** lane-2 T15–T18: a named timeline view is closed and bounded. Refs are bounded strings, not checked against the Scene:
 * they name graph nodes and cause-chain ids, which the native owner resolves on restore (a missing one is reported, never invented). */
export function validateTimelineView(value:unknown):asserts value is TimelineViewRecord{
 const ref=(v:unknown):v is string=>typeof v==='string'&&text(v,TIMELINE_REF_MAX)&&v.length>0;
 require(object(value),'Invalid timeline view');keys(value,['camera','projection','relationLinks','filters','chainId','frameNodeId','workingSetRefs']);
 const [zoomLow,zoomHigh]=TIMELINE_PIXELS_PER_YEAR_RANGE;
 require(object(value.camera),'Invalid timeline view camera');keys(value.camera,['centerYear','pixelsPerYear']);
 require(finite(value.camera.centerYear,-TIMELINE_CENTER_YEAR_LIMIT,TIMELINE_CENTER_YEAR_LIMIT)&&finite(value.camera.pixelsPerYear,zoomLow,zoomHigh),'Timeline view camera exceeds its bound');
 require(value.projection==='chronology'||value.projection==='relations','Invalid timeline view projection');
 require(typeof value.relationLinks==='boolean','Invalid timeline view relation links');
 const filters=value.filters;require(object(filters),'Invalid timeline view filters');keys(filters,['hiddenCategories','relationTypes','tags']);
 require(Array.isArray(filters.hiddenCategories)&&filters.hiddenCategories.length<=TIMELINE_CATEGORY_IDS.length&&filters.hiddenCategories.every((id:unknown)=>typeof id==='string'&&TIMELINE_CATEGORY_IDS.includes(id)),'Invalid timeline view category filter');
 require(filters.relationTypes===null||Array.isArray(filters.relationTypes)&&filters.relationTypes.length<=256&&filters.relationTypes.every((name:unknown)=>text(name,160)&&!!name),'Invalid timeline view relation filter');
 require(Array.isArray(filters.tags)&&filters.tags.length<=256&&filters.tags.every((tag:unknown)=>text(tag,160)&&!!tag),'Invalid timeline view tag filter');
 require(value.chainId===null||ref(value.chainId),'Invalid timeline view walk');
 if(value.frameNodeId!==undefined)require(ref(value.frameNodeId),'Invalid timeline view frame');
 require(Array.isArray(value.workingSetRefs)&&value.workingSetRefs.length<=TIMELINE_VIEW_REF_LIMIT&&value.workingSetRefs.every(ref)&&new Set(value.workingSetRefs).size===value.workingSetRefs.length,'Invalid timeline view working set');
}
function validateViewport(v:unknown):void{require(object(v),'Invalid research viewport');keys(v,['x','y','zoom','pitch','bearing']);require(finite(v.x,-1e8,1e8)&&finite(v.y,-1e8,1e8)&&finite(v.zoom,.001,1e5)&&(v.pitch===undefined||finite(v.pitch,0,85))&&(v.bearing===undefined||finite(v.bearing,-180,180)),'Research viewport exceeds its bound');}
/** lane-4 T20: the closed Places vocabularies a view or the layer record admits. The ids are the basemap registry's own; the kernel holds the same list. */
export const PLACE_VIEW_LIMIT=32;
const PLACE_STANDINGS:readonly PlaceStanding[]=['factual','mythic','owner-vocabulary'];
const PLACE_BASEMAP_IDS:readonly string[]=[OFFLINE_GROUND_ID,...LIVE_BASEMAP_SOURCES.map(source=>source.id)];
/** The layer fields of a place view (its toggles and basemap rows); the caller passes only those fields. */
function validatePlaceLayers(value:Record<string,any>):void{
 keys(value,['relations','standing','basemap']);
 if(value.relations!==undefined)require(Array.isArray(value.relations)&&value.relations.length<=256&&value.relations.every((name:unknown)=>text(name,160)),'Invalid place view layers');
 if(value.standing!==undefined)require(Array.isArray(value.standing)&&value.standing.length<=PLACE_STANDINGS.length&&value.standing.every((name:unknown)=>PLACE_STANDINGS.includes(name as PlaceStanding)),'Invalid place view standing');
 if(value.basemap!==undefined){
  require(object(value.basemap),'Invalid place view basemap');keys(value.basemap,['terrainVisible','layers']);
  require(typeof value.basemap.terrainVisible==='boolean'&&object(value.basemap.layers),'Invalid place view basemap');
  for(const [id,layer] of Object.entries(value.basemap.layers)){
   require(PLACE_BASEMAP_IDS.includes(id),'Unknown basemap layer');require(object(layer),'Invalid basemap layer');keys(layer,['visible','opacity']);
   require(typeof layer.visible==='boolean'&&finite(layer.opacity,0,1),'Invalid basemap layer');
  }
 }
}
/** lane-4 T21: a whole Places layers record (toggles and basemap rows), closed and bounded by the same rules a view's layers meet. */
export function validatePlaceLayersRecord(value:unknown):asserts value is PlaceLayersRecord{require(object(value),'Invalid place layers');validatePlaceLayers(value);}
/** lane-4 T20: a named Places view is closed, bounded and refs-free: camera (longitude x, latitude y, zoom, pitch, bearing), the layer toggles, the basemap rows and the shared time window. */
export function validatePlaceView(value:unknown):void{
 require(object(value),'Invalid place view');keys(value,['viewport','relations','standing','basemap','window']);
 validateViewport(value.viewport);
 require(finite(value.viewport.x,-180,180)&&finite(value.viewport.y,-90,90),'Place view camera exceeds the globe');
 validatePlaceLayers({relations:value.relations,standing:value.standing,basemap:value.basemap});
 require(value.window!==undefined,'Invalid place view window');
 if(value.window!==null){require(object(value.window),'Invalid place view window');keys(value.window,['from','to']);require(['from','to'].every(key=>value.window[key]===null||typeof value.window[key]==='string'&&text(value.window[key],64)),'Invalid place view window');}
}
/** Tolerant plain-text reading of note blocks: paragraphs join with newlines,
 * non-text parts are skipped. Unlike expressionTextFromNote this never
 * throws — it is a projection for display, not a validation law. Exported
 * for the B2 .canvas export. */
export function notePlainText(content:string):string{
 try{const blocks:unknown=JSON.parse(content);if(!Array.isArray(blocks))return '';
  return blocks.map((raw:any)=>{
   if(!raw||raw.type!=='paragraph'||!Array.isArray(raw.content))return '';
   return raw.content.filter((part:any)=>part?.type==='text'&&typeof part.text==='string').map((part:any)=>part.text).join('');
  }).join('\n').replace(/\n{3,}/g,'\n\n').trim();
 }catch{return '';}
}
/** lane-1 A2: the tool choice a canvas object kind is created from (a shape is named by its geometry). */
function canvasObjectChoice(kind:CanvasObjectKind,geometry:unknown):CanvasToolChoice{
 if(kind==='sticky')return 'sticky';
 if(kind==='text')return 'text';
 require(isShapeGeometry(geometry),'A shape needs a geometry');
 return geometry;
}
/** Mutate only the supplied working Scene; caller persists through the existing
 * composition CAS. Validate before replacing so a refusal leaves it intact.
 * A batch applies its steps to one working copy and validates once (B2). */
export function applyResearchMaterial(scene:Scene,action:ResearchMaterialAction):void {
 const next=clone(scene);
 if(action.type==='batch'){
  require(text(action.label,160)&&!!action.label.trim(),'Invalid batch label');
  require(Array.isArray(action.actions)&&action.actions.length>=1&&action.actions.length<=256,'A batch holds one to 256 changes');
  for(const step of action.actions){require(step.type!=='batch','A batch cannot hold another batch');applyResearchStep(next,step);}
 }else applyResearchStep(next,action);
 require(next.entities.length<=32,'Scene authoring occurrence limit reached');
 validateResearchMaterial(next.research!,new Set(next.entities.map(e=>e.id)));
 Object.assign(scene,next);
}
function applyResearchStep(next:Scene,action:Exclude<ResearchMaterialAction,{type:'batch'}>):void {
 const research=next.research??=emptyResearchMaterial();
 // Research material saved before frames/named views existed carries
 // neither field; backfill on first write so every action below can assume
 // both are present, matching every other record collection here.
 research.frames??={};research.namedViews??={};
 const target=(id:string)=>{const found=next.entities.find(e=>e.id===id);require(found&&!found.locked,'Occurrence is missing or locked');return found;};
 // Presentation metadata must not manufacture a local note body over a
 // source-bound occurrence. Only explicit note creation/content owns content.
 const card=(id:string)=>{const e=target(id);return research.cards[id]??={type:e.source?.kind==='image'?'image':'note'};};
 switch(action.type){
 // Canvas display size is Research Canvas presentation only. It must never
 // reach the entity's own `size`, which is the Expression's expressive
 // body — resizing a card on this Canvas is not editing the source.
 case 'resize':{require(finite(action.width,40,40000)&&finite(action.height,40,40000),'Invalid card size');card(action.id).size={width:action.width,height:action.height};break;}
 case 'duplicate':{const original=target(action.id),copy=clone(original);copy.id=uid('research');copy.name=original.name+' copy';copy.position.x+=.1;copy.position.y-=.1;delete copy.native;next.entities.push(copy);if(research.cards[action.id])research.cards[copy.id]=clone(research.cards[action.id]);break;}
 case 'create-card':{require(finite(action.position.x,-100,100)&&finite(action.position.y,-100,100),'Invalid card position');
  // lane-1 A2: a canvas object is named by its tool choice (a shape by its geometry); its label is the occurrence name.
  const choice=isCanvasObjectKind(action.kind)?canvasObjectChoice(action.kind,action.geometry):undefined;
  // lane-1 A10: an embed is named by its host and a media card by its file, unless the owner named it.
  const link=action.kind==='embed'?embedUrlRecord(action.url):null;require(action.kind!=='embed'||link!==null,'Invalid embed link');
  require(action.kind!=='media'||isCentralPathRef(action.media),'Invalid media reference');
  const title=action.title??(choice?CANVAS_TOOL_SPEC[choice].label:link!==null?embedHost(link):isCentralPathRef(action.media)?mediaFileName(action.media):action.kind==='image'?'Image':'Note');require(text(title,160)&&!!title,'Invalid card title');const e=entity(title,title.slice(0,120),{...action.position,z:0});if(action.id!==undefined)require(text(action.id,128)&&/^[A-Za-z0-9_-]+$/.test(action.id)&&!next.entities.some(x=>x.id===action.id),'Invalid card id');e.id=action.id??uid('research');e.size={x:.6,y:.4};const c:ResearchCard={type:action.kind};if(action.kind==='note')c.content='[]';
  // A note and a canvas object (sticky, shape, text — lane-1 A2) are canvas presentation: on the stage they are a quiet disc, never
  // a text formation spelling the tool's name. The object's label is its card caption.
  if(action.kind==='note'||choice||action.kind==='embed'||action.kind==='media'){e.shape='disc';e.text='';for(const step of e.sequence.steps){step.shape='disc';step.text='';}}if(action.kind==='image'){require(typeof action.dataUrl==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(action.dataUrl),'Choose a PNG/JPEG/WebP image');require(action.dataUrl.length<=262144,'Image exceeds native document budget; select a smaller image');c.importedAt=new Date().toISOString();e.source={kind:'image',image:{dataUrl:action.dataUrl,mode:'luminance',threshold:.5,invert:false,scale:1,name:title}};}if(choice){const spec=CANVAS_TOOL_SPEC[choice];c.size={...spec.size};if(action.kind==='sticky')c.palette=STICKY_DEFAULT_PALETTE;if(action.kind==='shape'){c.shape=spec.geometry;c.fill='none';}}if(link!==null){c.url=link;c.size={...EMBED_CARD_SIZE};}if(action.kind==='media'&&isCentralPathRef(action.media)){c.media=clone(action.media);c.size={...MEDIA_CARD_SIZE};}next.entities.push(e);research.cards[e.id]=c;break;}
 case 'card-content':{const c=card(action.id);require(c.type==='note','Only note cards own rich note content');validateResearchContent(action.content);c.content=action.content;
  // The note's readable text is mirrored onto the occurrence, so the
  // Expression's own views (verso, tree, readers) show the note as text,
  // not an empty glyph. The rich block structure stays on the card.
  const e=target(action.id);const flat=notePlainText(action.content);
  e.text=flat;e.name=flat.split('\n')[0].slice(0,160)||'Note';
  for(const step of e.sequence.steps){step.text=flat.slice(0,120);}
  break;}
 case 'card-caption':card(action.id).caption=action.caption;break;
 case 'card-style':Object.assign(card(action.id),action.patch);break;
 case 'annotation-add':research.strokes.push(clone(action.stroke));break;
 case 'annotation-remove':research.strokes=research.strokes.filter(s=>s.id!==action.id);break;
 case 'viewport':research.views[action.key]=clone(action.value);break;
 case 'timeline-layout':{const previous=research.timeline[action.id];require(action.expectedRevision===(previous?.layoutRevision??null),'Timeline layout changed; reload before editing again');research.timeline[action.id]={...clone(action.value),layoutRevision:(previous?.layoutRevision??0)+1};break;}
 // A frame is a presentation grouping over existing occurrence ids — never
 // a constellation-membership change (that is the native owner's business
 // through its own explicit Action). Re-saving an existing frame id keeps
 // its current z so re-labelling or re-grouping never silently re-orders it.
 case 'frame-save':{
  require(text(action.label,160)&&!!action.label.trim(),'Invalid frame label');
  require(Array.isArray(action.memberRefs)&&action.memberRefs.length>=1&&action.memberRefs.length<=64,'A frame needs at least one member');
  const members=[...new Set(action.memberRefs)];
  for(const ref of members)require(next.entities.some(e=>e.id===ref),'Frame member is missing');
  const existing=research.frames[action.id];
  // Re-labelling or re-grouping keeps the owner's heading and order; only the membership and label change.
  research.frames[action.id]={label:action.label,...(existing?.title!==undefined?{title:existing.title}:{}),memberRefs:members,z:existing?.z??Object.keys(research.frames).length};
  break;
 }
 case 'frame-remove':delete research.frames[action.id];break;
 // lane-1 A9: the heading is the owner's text; a blank one removes the key, so a cleared frame leaves no trace.
 case 'frame-title':{
  const frame=research.frames[action.id];require(frame,'Frame is missing');
  const title=frameTitleRecord(action.title);
  if(title===null)delete frame.title;else frame.title=title;
  break;
 }
 case 'frame-order':{
  const frame=research.frames[action.id];require(frame,'Frame is missing');
  const others=Object.entries(research.frames).filter(([id])=>id!==action.id).map(([,f])=>f.z);
  frame.z=action.direction==='front'?(others.length?Math.max(...others):frame.z)+1:(others.length?Math.min(...others):frame.z)-1;
  break;
 }
 // A saved view restores camera plus the presentation state a person would
 // expect it to: which cards were selected, and which frame sits on top —
 // never a second copy of graph material.
 case 'view-save':{
  require(text(action.name,160)&&!!action.name.trim(),'Invalid view name');require(viewNameAllowed(action.name),'That view name is reserved');
  validateViewport(action.viewport);
  require(Array.isArray(action.selectedRefs)&&action.selectedRefs.length<=64&&action.selectedRefs.every(ref=>typeof ref==='string'),'Invalid view selection');
  require(Array.isArray(action.frameOrder)&&action.frameOrder.length<=64&&action.frameOrder.every(ref=>typeof ref==='string'),'Invalid view frame order');
  if(action.basis!==undefined)validateViewBasis(action.basis);
  research.namedViews[action.name]={viewport:clone(action.viewport),selectedRefs:[...action.selectedRefs],frameOrder:[...action.frameOrder],...(action.basis?{basis:clone(action.basis)}:{})};
  break;
 }
 case 'view-remove':delete research.namedViews[action.name];break;
 // lane-4 T20: a Places view is kept beside the canvas views and never among them. Its bounds are checked with the whole material below.
 case 'place-view-save':{
  require(text(action.name,160)&&!!action.name.trim(),'Invalid view name');require(viewNameAllowed(action.name),'That view name is reserved');
  research.placeViews??={};research.placeViews[action.name]=clone(action.place);
  break;
 }
 // Removing a Places view touches only placeViews; the Scene's occurrences, frames and canvas views stay as they were.
 case 'place-view-remove':{if(research.placeViews){delete research.placeViews[action.name];if(!Object.keys(research.placeViews).length)delete research.placeViews;}break;}
 // lane-4 T21: the layers are written whole and bounded here, and the whole material is checked again below.
 case 'place-layers-set':{validatePlaceLayersRecord(action.value);research.placeLayers=clone(action.value);break;}
 // lane-4 T25: a tour is kept beside the Places views and never among them. Its name and its shape are checked before it is written.
 case 'place-tour-save':{
  const nameProblem=placeTourNameProblem(action.name,research.placeTours??{});require(nameProblem===null,nameProblem??'');
  const tourProblem=placeTourProblem(action.tour);require(tourProblem===null,tourProblem??'');
  research.placeTours??={};research.placeTours[action.name.trim()]=clone(action.tour);
  break;
 }
 // Removing a tour touches only placeTours; the last removal leaves no empty record.
 case 'place-tour-remove':{if(research.placeTours){delete research.placeTours[action.name];if(!Object.keys(research.placeTours).length)delete research.placeTours;}break;}
 // lane-2 T15: a timeline view is kept beside the other views. Its count bound is checked with the whole material below.
 case 'timeline-view-save':{
  require(text(action.name,160)&&!!action.name.trim(),'Invalid timeline view name');require(viewNameAllowed(action.name),'That view name is reserved');
  validateTimelineView(action.view);
  research.timelineViews??={};research.timelineViews[action.name]=clone(action.view);
  break;
 }
 // Removing a timeline view touches only timelineViews: no occurrence, timeline layout, frame or other view is changed.
 case 'timeline-view-remove':{if(research.timelineViews){delete research.timelineViews[action.name];if(!Object.keys(research.timelineViews).length)delete research.timelineViews;}break;}
 }
}
/** lane-1 A3–A4: sets one connector's presentation record, or clears it with null,
 * keyed by the native edge id. Mutates only the supplied working Scene; the
 * native relation (kind, direction, endpoints) is never touched here. An empty
 * record map is removed, so a Scene with no connectors is unchanged. */
export function applyConnectorRecord(scene:Scene,edgeId:string,value:ResearchConnector|null):void {
 require(text(edgeId,CONNECTOR_KEY_MAX)&&!!edgeId,'Invalid connector edge');
 const next=clone(scene);const research=next.research??=emptyResearchMaterial();
 research.frames??={};research.namedViews??={};
 const connectors={...(research.connectors??{})};
 if(value===null)delete connectors[edgeId];else{validateConnector(value);connectors[edgeId]=clone(value);}
 if(Object.keys(connectors).length)research.connectors=connectors;else delete research.connectors;
 validateResearchMaterial(research,new Set(next.entities.map(e=>e.id)));
 Object.assign(scene,next);
}
