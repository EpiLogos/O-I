/** Lane-2 T15–T18 — named timeline views and timeline card style, as pure logic (no DOM, no store).
 *
 * A view records what the person was reading on the M2′ chronology: the camera, the projection and relation mode, the
 * category, relation-type and tag filters, the followed cause chain (the walk position), the open sub-timeline frame and
 * the stacked working set. It holds refs and presentation only, never a copy of a node: restoring re-reads each ref
 * through the native owner (expandNode), so a changed node is shown at its current revision.
 *
 * Laws:
 * - Removing a view touches only timelineViews; no occurrence, layout, frame or other view changes.
 * - A ref that no longer resolves is reported on restore, never invented or silently dropped.
 * - A card colour is written only in the card-style colour grammar; anything else is refused with the reason.
 */
import {
  TIMELINE_CENTER_YEAR_LIMIT,
  TIMELINE_PIXELS_PER_YEAR_RANGE,
  TIMELINE_VIEW_LIMIT,
  TIMELINE_VIEW_REF_LIMIT,
  validateTimelineStyle,
  validateTimelineView,
  type TimelineCardStyle,
  type TimelineProjection,
  type TimelineViewRecord,
} from './researchMaterial.js';
import {TIMELINE_CATEGORY_IDS} from './timelineCategoryIds';

/** The lens's presentation as a view holds it (structurally the vendored TimelineLens snapshot, without the camera). */
export interface TimelinePresentation {
  camera:{centerYear:number;pixelsPerYear:number};
  hiddenCategories:string[];
  relationTypes:string[]|null;
  tags:string[];
  relationLinks:boolean;
  chainId:string|null;
  frameNodeId:string|null;
  workingSetRefs:string[];
}

/** The reason a view cannot be saved under this name, in the owner's words; null when it can. */
export function timelineViewNameProblem(name:string,existing:Readonly<Record<string,unknown>>):string|null{
 const trimmed=name.trim();
 if(!trimmed)return 'Name the timeline view first.';
 if(trimmed.length>160)return 'A timeline view name is at most 160 characters.';
 if(!(trimmed in existing)&&Object.keys(existing).length>=TIMELINE_VIEW_LIMIT)return `A timeline keeps at most ${TIMELINE_VIEW_LIMIT} views. Remove one before saving another.`;
 return null;
}

/** The colours a card carries, as the layout record keeps them. Only the three colour keys are a native mapping: any other
 * key is refused with its name, and an invalid colour is refused with the rule it broke (the write never lands half-done). */
export function timelineStyleOf(style:Readonly<Record<string,unknown>>):TimelineCardStyle{
 const copy:Record<string,string>={};
 for(const [key,value] of Object.entries(style)){
  if(value===undefined)continue;
  if(!['dotColour','bgColour','textColour'].includes(key))throw new Error(`Timeline style field "${key}" has no native Scene write mapping`);
  copy[key]=value as string;
 }
 validateTimelineStyle(copy);
 return copy as TimelineCardStyle;
}

/** The style a card loads with: the stored colours, or none (the category's own colours). */
export function timelineStyleLoaded(style:TimelineCardStyle|undefined):Record<string,string>{
 return style?{...(style as Record<string,string>)}:{};
}

/** The presentation of a chronology nobody has filtered, framed or stacked: every category shown, no relation-type or tag
 * filter, the relation links drawn, no walk chain, no frame, an empty working set. */
export function openTimelinePresentation(camera:{centerYear:number;pixelsPerYear:number}):TimelinePresentation{
 return {camera:{...camera},hiddenCategories:[],relationTypes:null,tags:[],relationLinks:true,chainId:null,frameNodeId:null,workingSetRefs:[]};
}

/** The lens's presentation as a named view keeps it. Working-set and chain refs are kept in the order the person stacked
 * them; duplicates are dropped; a stack larger than the view's budget is refused, never truncated. */
export function timelineViewOf(input:{projection:TimelineProjection;presentation:TimelinePresentation}):TimelineViewRecord{
 const {presentation}=input;const camera=presentation.camera;
 if(!Number.isFinite(camera.centerYear)||!Number.isFinite(camera.pixelsPerYear))throw new Error('The timeline camera is not readable, so the view was not saved.');
 const [zoomLow,zoomHigh]=TIMELINE_PIXELS_PER_YEAR_RANGE;
 const refs=[...new Set(presentation.workingSetRefs)];
 if(refs.length>TIMELINE_VIEW_REF_LIMIT)throw new Error(`A timeline view keeps at most ${TIMELINE_VIEW_REF_LIMIT} working-set nodes. Remove some from the stack before saving.`);
 const hidden=TIMELINE_CATEGORY_IDS.filter(id=>presentation.hiddenCategories.includes(id));
 const view:TimelineViewRecord={
  camera:{
   centerYear:Math.min(TIMELINE_CENTER_YEAR_LIMIT,Math.max(-TIMELINE_CENTER_YEAR_LIMIT,camera.centerYear)),
   pixelsPerYear:Math.min(zoomHigh,Math.max(zoomLow,camera.pixelsPerYear)),
  },
  projection:input.projection,
  relationLinks:presentation.relationLinks,
  filters:{
   hiddenCategories:hidden,
   relationTypes:presentation.relationTypes===null?null:[...new Set(presentation.relationTypes)],
   tags:[...new Set(presentation.tags)],
  },
  chainId:presentation.chainId,
  workingSetRefs:refs,
  ...(presentation.frameNodeId!==null?{frameNodeId:presentation.frameNodeId}:{}),
 };
 validateTimelineView(view);
 return view;
}

/** What restoring a view sets: the projection, and the lens presentation the view names. */
export function timelineViewRestorePlan(view:TimelineViewRecord):{projection:TimelineProjection;presentation:TimelinePresentation}{
 return {
  projection:view.projection,
  presentation:{
   camera:{...view.camera},
   hiddenCategories:[...view.filters.hiddenCategories],
   relationTypes:view.filters.relationTypes===null?null:[...view.filters.relationTypes],
   tags:[...view.filters.tags],
   relationLinks:view.relationLinks,
   chainId:view.chainId,
   frameNodeId:view.frameNodeId??null,
   workingSetRefs:[...view.workingSetRefs],
  },
 };
}

/** The result of a restore, in the owner's words: the refs that could not be re-read (absent nodes, a frame the reading no
 * longer holds). An empty list is a complete restore. */
export function timelineRestoreNote(name:string,unresolved:readonly string[]):string{
 if(!unresolved.length)return `View "${name}" restored`;
 return `View "${name}" restored; ${unresolved.length} ${unresolved.length===1?'node is':'nodes are'} no longer in this reading and ${unresolved.length===1?'was':'were'} left out.`;
}
