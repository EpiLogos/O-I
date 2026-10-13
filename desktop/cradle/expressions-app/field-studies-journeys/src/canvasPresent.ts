import {fitViewport,CANVAS_ZOOM_LIMITS,type Box,type Size,type Viewport,type ZoomLimits} from '../../vendor/research-canvas/packages/canvas/src/canvas/navigationGeometry';
import type {CanvasFindTarget} from './canvasFind';

/** A8 — the Present act's glyph, drawn in the canvas tool row's 24×24 stroke grammar. */
export const PRESENT_GLYPH='M4 5h16v11H4Z M9 20h6 M12 16v4';

export interface PresentFrame {ref:string;label:string;boxes:Box[]}

/** The saved frame order is the one the find corpus already fixes (z ascending,
 * ref tie-break). Frames only: occurrences are not presented as steps. A frame
 * whose members are not all on the loaded Canvas is skipped, as Find skips it,
 * so a presentation never travels to bounds it cannot prove. */
export function presentFrames(targets:readonly CanvasFindTarget[],boxOf:(nodeId:string)=>Box|undefined):PresentFrame[] {
 const frames:PresentFrame[]=[];
 for(const target of targets){
  if(target.kind!=='frame')continue;
  const boxes=target.node_ids.map(boxOf);
  if(boxes.length&&boxes.every((box):box is Box=>!!box))frames.push({ref:target.ref,label:target.label,boxes});
 }
 return frames;
}

/** Session-local step model: the index clamps at both ends. There is no wrap
 * and no timer, so the last frame stays on screen until the person leaves. */
export function presentStep(index:number,count:number,direction:1|-1):number {
 if(count<=0)return 0;
 return Math.min(count-1,Math.max(0,index+direction));
}

/** The camera that fits one frame's bounds in the pane, with the Canvas's fit
 * margin on every side and the Canvas's zoom limits. Undefined when the pane
 * has no size yet, so the caller never flies to a guess. */
export function presentViewport(boxes:readonly Box[],pane:Size,limits:ZoomLimits=CANVAS_ZOOM_LIMITS):Viewport|undefined {
 return fitViewport(boxes,pane,limits)?.viewport;
}
