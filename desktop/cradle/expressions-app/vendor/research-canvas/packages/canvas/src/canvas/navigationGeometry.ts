/**
 * Canvas navigation geometry — lane-1 A1 (alignment guides) and A6 (fit and
 * zoom). Geometry has no React and no store. The one DOM read is
 * `prefersReducedMotion`, guarded for absent matchMedia so node tests run.
 * Presentation only: nothing here can reach a document, a relation or a
 * native write.
 *
 * Node-to-node snapping is not implemented here. It is the Technē canvas
 * model's `snapPosition` (`src/techne/m0m5/canvas/interactions.ts`, imported
 * read-only). This module adapts top-left node boxes to that model's centre
 * points and edge sizes, owns the screen-space threshold, and turns guides
 * into viewport segments.
 *
 * Coordinates are flow units (the canvas's node space). The viewport is the
 * xyflow transform: screen = flow * zoom + offset, measured from the pane's
 * top-left corner.
 */
import {snapPosition,type PositionedNode} from '../../../../../../../src/techne/m0m5/canvas/interactions';

export interface Viewport {x:number;y:number;zoom:number}
export interface Size {width:number;height:number}
/** A node box in flow units: top-left corner plus size. */
export interface Box extends Size {x:number;y:number}
export interface ZoomLimits {minZoom:number;maxZoom:number}
export interface GuideLine {axis:'x'|'y';at:number}
export interface GuideSegment {x1:number;y1:number;x2:number;y2:number}

/** Breathing room between the fitted content and the pane edge. */
export const FIT_MARGIN_PX = 48;
/** Excalidraw's SNAP_DISTANCE, a screen distance: divided by zoom in flow units. */
export const SNAP_THRESHOLD_PX = 8;
/** The same factor xyflow's own zoomIn/zoomOut use for the tool row's +/−. */
export const ZOOM_STEP = 1.2;
/** Two centres closer than this (flow units) count as one guide line. */
export const GUIDE_TOLERANCE = 0.5;
/** The one zoom range the vendored Canvas and its hosts share. The floor is
 * low enough that fit-all of a 50-card scatter fits at 390x844 (needs ~0.073);
 * the ceiling is xyflow's own default. */
export const CANVAS_ZOOM_LIMITS:ZoomLimits={minZoom:0.05,maxZoom:2};

/** True when the user asks for reduced motion. Absent matchMedia (node tests,
 * old hosts) reads as no preference. */
export function prefersReducedMotion():boolean{
 const query=(globalThis as {matchMedia?:(q:string)=>{matches:boolean}}).matchMedia;
 return typeof query==='function'&&!!query('(prefers-reduced-motion: reduce)').matches;
}

/** Every camera move's transition duration in ms: 0 under reduced motion. */
export function cameraDuration(ms:number):number{
 return prefersReducedMotion()?0:ms;
}

export function clampZoom(zoom:number,limits:ZoomLimits):number{
 return Math.min(limits.maxZoom,Math.max(limits.minZoom,zoom));
}

/** The union box of a set of node boxes, or null for an empty set. */
export function boxesBounds(boxes:readonly Box[]):Box|null{
 if(!boxes.length)return null;
 const minX=Math.min(...boxes.map(box=>box.x)),minY=Math.min(...boxes.map(box=>box.y));
 const maxX=Math.max(...boxes.map(box=>box.x+box.width)),maxY=Math.max(...boxes.map(box=>box.y+box.height));
 return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}

/** The viewport that frames every box fully inside the pane with `margin`
 * px on each side, centred. `clamped` is true when the zoom limit stopped
 * the fit short, so some box is not fully visible at the returned viewport. */
export function fitViewport(
 boxes:readonly Box[],
 pane:Size,
 limits:ZoomLimits,
 margin:number=FIT_MARGIN_PX,
):{viewport:Viewport;clamped:boolean}|null{
 const bounds=boxesBounds(boxes);
 if(!bounds||pane.width<=0||pane.height<=0)return null;
 const availableWidth=Math.max(1,pane.width-margin*2),availableHeight=Math.max(1,pane.height-margin*2);
 const wanted=Math.min(availableWidth/Math.max(bounds.width,1),availableHeight/Math.max(bounds.height,1));
 const zoom=clampZoom(wanted,limits);
 return {
  viewport:{
   zoom,
   x:pane.width/2-(bounds.x+bounds.width/2)*zoom,
   y:pane.height/2-(bounds.y+bounds.height/2)*zoom,
  },
  clamped:zoom!==wanted,
 };
}

/** Set the zoom to `zoom` (clamped) keeping the pane's centre point fixed. */
export function zoomTo(viewport:Viewport,zoom:number,pane:Size,limits:ZoomLimits):Viewport{
 const next=clampZoom(zoom,limits),ratio=next/viewport.zoom;
 const cx=pane.width/2,cy=pane.height/2;
 return {zoom:next,x:cx-(cx-viewport.x)*ratio,y:cy-(cy-viewport.y)*ratio};
}

/** The readout label for a zoom level: whole percent, no decimals. */
export function zoomPercent(zoom:number):string{
 return `${Math.round(zoom*100)}%`;
}

export interface SnapOutcome {
 /** The dragged box's top-left after alignment (unchanged on a miss). */
 topLeft:{x:number;y:number};
 /** The dragged box after alignment, for guide extents. */
 box:Box;
 /** Guides the position settled onto; empty when nothing was in threshold. */
 guides:GuideLine[];
}

/** Align a dragged card to the edges and centres of the other cards, within 8
 * screen px (÷ zoom). Delegates the choice to the Technē model's snapPosition;
 * this function converts top-left boxes to centres and back, and passes the
 * sizes so edges align too. */
export function snapDraggedBox(
 dragged:Box,
 others:readonly {ref:string;box:Box}[],
 zoom:number,
 draggedRef:string,
):SnapOutcome{
 const centre=(box:Box)=>({x:box.x+box.width/2,y:box.y+box.height/2});
 const positioned:PositionedNode[]=others.map(other=>({ref:other.ref,...centre(other.box),radius:0}));
 const sizes:Record<string,{width:number;height:number}>={};
 for(const other of others)sizes[other.ref]={width:other.box.width,height:other.box.height};
 const threshold=SNAP_THRESHOLD_PX/(zoom>0?zoom:1);
 const outcome=snapPosition(centre(dragged),positioned,draggedRef,threshold,{boxes:{dragged:{width:dragged.width,height:dragged.height},others:sizes}});
 const topLeft={x:outcome.position.x-dragged.width/2,y:outcome.position.y-dragged.height/2};
 return {topLeft,box:{...dragged,...topLeft},guides:outcome.guides.map(guide=>({axis:guide.axis,at:guide.at}))};
}

/** Grid snapping composes after alignment: an axis that settled onto a guide
 * keeps the guided value; the other axis takes the grid value. */
export function keepGuidedAxes(aligned:SnapOutcome,gridded:{x:number;y:number}):{x:number;y:number}{
 return {
  x:aligned.guides.some(guide=>guide.axis==='x')?aligned.topLeft.x:gridded.x,
  y:aligned.guides.some(guide=>guide.axis==='y')?aligned.topLeft.y:gridded.y,
 };
}

/** Each guide as a viewport segment spanning the boxes with an edge or centre
 * on it. Guides are presentation only: computed from the live viewport on
 * every render, never stored in the document. */
export function guideSegments(
 guides:readonly GuideLine[],
 boxes:readonly Box[],
 viewport:Viewport,
):GuideSegment[]{
 const segments:GuideSegment[]=[];
 for(const guide of guides){
  const members=boxes.filter(box=>{
   const lines=guide.axis==='x'
    ?[box.x,box.x+box.width/2,box.x+box.width]
    :[box.y,box.y+box.height/2,box.y+box.height];
   return lines.some(line=>Math.abs(line-guide.at)<=GUIDE_TOLERANCE);
  });
  if(!members.length)continue;
  if(guide.axis==='x'){
   const top=Math.min(...members.map(box=>box.y)),bottom=Math.max(...members.map(box=>box.y+box.height));
   const sx=guide.at*viewport.zoom+viewport.x;
   segments.push({x1:sx,y1:top*viewport.zoom+viewport.y,x2:sx,y2:bottom*viewport.zoom+viewport.y});
  }else{
   const left=Math.min(...members.map(box=>box.x)),right=Math.max(...members.map(box=>box.x+box.width));
   const sy=guide.at*viewport.zoom+viewport.y;
   segments.push({x1:left*viewport.zoom+viewport.x,y1:sy,x2:right*viewport.zoom+viewport.x,y2:sy});
  }
 }
 return segments;
}
