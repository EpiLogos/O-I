import type {GraphEdge} from './graph';
export interface GraphScreenEdge {edge:GraphEdge;index:number;from:{x:number;y:number};to:{x:number;y:number}}
export function graphScreenEdges(edges:readonly GraphEdge[],positions:ReadonlyMap<string,{x:number;y:number}>):GraphScreenEdge[]{
 return edges.flatMap((edge,index)=>{const from=positions.get(edge.from_ref),to=positions.get(edge.to_ref);return from&&to&&[from.x,from.y,to.x,to.y].every(Number.isFinite)?[{edge,index,from,to}]:[];});
}
export function hitGraphScreenEdge(edges:readonly GraphScreenEdge[],point:{x:number;y:number},threshold:number):GraphScreenEdge|undefined {
 if(![point.x,point.y,threshold].every(Number.isFinite)||threshold<0)return;
 let closest:GraphScreenEdge|undefined,distance=threshold;
 for(const item of edges){const dx=item.to.x-item.from.x,dy=item.to.y-item.from.y,length=dx*dx+dy*dy;if(!length)continue;const t=Math.max(0,Math.min(1,((point.x-item.from.x)*dx+(point.y-item.from.y)*dy)/length)),d=Math.hypot(point.x-item.from.x-t*dx,point.y-item.from.y-t*dy);if(d<distance){distance=d;closest=item;}}
 return closest;
}
/** Relation captions exist only during actual pointer/selection emphasis.
 * Missing endpoints and unresolved associations never gain native labels. */
export function emphasizedGraphRelations(edges:readonly GraphScreenEdge[],input:{selected?:string;hovered?:string;hoveredEdge?:number;focused:ReadonlySet<string>}):GraphScreenEdge[]{
 return edges.filter(({edge,index})=>!!edge.relation&&(index===input.hoveredEdge||!!input.hovered&&(edge.from_ref===input.hovered||edge.to_ref===input.hovered)||!!input.selected&&input.focused.has(edge.from_ref)&&input.focused.has(edge.to_ref)));
}
/** A relation caption's life across emphasis: it eases in from the moment its
 * emphasis began and eases out from the moment it left. The motion duration
 * (zero under reduced motion) switches at once. */
export interface GraphCaptionLife {since:number;leftAt?:number}
export function graphCaptionAlpha(life:GraphCaptionLife,now:number,duration:number):number {
 if(![now,life.since,duration].every(Number.isFinite))return 0;
 if(life.leftAt!==undefined)return duration>0?Math.max(0,1-(now-life.leftAt)/duration):0;
 return duration>0?Math.min(1,Math.max(0,(now-life.since)/duration)):1;
}
/** Advances the caption lives to one frame. A caption whose relation is newly
 * emphasised begins (or re-begins after leaving); one whose relation left
 * starts to fade; a departed caption that has faded is dropped. Returns the
 * captions to draw at their alpha, and whether any is still easing. */
export function advanceGraphCaptions(lives:Map<number,GraphCaptionLife>,live:ReadonlySet<number>,now:number,duration:number):{drawn:{index:number;alpha:number}[];fading:boolean} {
 for(const index of live){const life=lives.get(index);if(!life||life.leftAt!==undefined)lives.set(index,{since:now});}
 for(const [index,life] of lives)if(!live.has(index)&&life.leftAt===undefined)life.leftAt=now;
 const drawn:{index:number;alpha:number}[]=[];let fading=false;
 for(const [index,life] of lives){
  const alpha=graphCaptionAlpha(life,now,duration);
  if(life.leftAt!==undefined&&alpha<=0){lives.delete(index);continue;}
  // A departing caption keeps the frames coming until it is dropped, even at full strength on its first frame.
  if(alpha<1||life.leftAt!==undefined)fading=true;
  if(alpha>0)drawn.push({index,alpha});
 }
 return {drawn,fading};
}
export interface GraphLabelBox {x:number;y:number;w:number;h:number}
export function admitGraphLabel(box:GraphLabelBox,existing:readonly GraphLabelBox[]):boolean {
 return [box.x,box.y,box.w,box.h].every(Number.isFinite)&&box.w>0&&box.h>0&&!existing.some(other=>other.x<box.x+box.w&&other.x+other.w>box.x&&other.y<box.y+box.h&&other.y+other.h>box.y);
}
