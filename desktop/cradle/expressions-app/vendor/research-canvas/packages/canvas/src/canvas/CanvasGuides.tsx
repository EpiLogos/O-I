import type {GuideSegment} from './navigationGeometry';

/** A1 — alignment guides drawn over the pane while a card is dragged within
 * threshold. Hairlines in the canvas's own hairline token; no text, no
 * animation, and nothing is kept once the drag releases (the host clears its
 * segments on release). */
export function CanvasGuides({segments}:{segments:readonly GuideSegment[]}){
 if(!segments.length)return null;
 return <svg className="canvas-guides" aria-hidden="true" focusable="false">
  {segments.map((segment,index)=><line key={index} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2}/>)}
 </svg>;
}
