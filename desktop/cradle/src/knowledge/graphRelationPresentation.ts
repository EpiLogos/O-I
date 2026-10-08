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
export interface GraphLabelBox {x:number;y:number;w:number;h:number}
export function admitGraphLabel(box:GraphLabelBox,existing:readonly GraphLabelBox[]):boolean {
 return [box.x,box.y,box.w,box.h].every(Number.isFinite)&&box.w>0&&box.h>0&&!existing.some(other=>other.x<box.x+box.w&&other.x+other.w>box.x&&other.y<box.y+box.h&&other.y+other.h>box.y);
}
