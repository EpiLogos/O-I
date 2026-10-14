export interface Camera {x:number;y:number;zoom:number}
/** The graph's zoom grammar, one source for every floor and ceiling (the
 * surface, its buttons, its restore guards and its fit). The floor matches the
 * Canvas's own (A6, CANVAS_ZOOM_LIMITS minZoom .05): a budget-scale reading
 * (4096 subjects spread over the layout's reach of ~3072 world units) must fit
 * whole, and at the old .15 floor it could not. */
export const GRAPH_ZOOM_LIMITS: {readonly minZoom: number; readonly maxZoom: number} = {minZoom: .05, maxZoom: 4};
export function zoomAt(camera:Camera,factor:number,x:number,y:number,min=GRAPH_ZOOM_LIMITS.minZoom,max=GRAPH_ZOOM_LIMITS.maxZoom):Camera {
  const zoom=Math.max(min,Math.min(max,camera.zoom*factor)),ratio=zoom/camera.zoom;
  return {zoom,x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio};
}
export function screenPoint(point:{x:number;y:number},camera:Camera,width:number,height:number) {
  return {x:width/2+camera.x+(point.x-400)*camera.zoom,y:height/2+camera.y+(point.y-260)*camera.zoom};
}
export function segmentVisible(a:{x:number;y:number},b:{x:number;y:number},width:number,height:number,margin=48) {
  return !(Math.max(a.x,b.x)<-margin||Math.min(a.x,b.x)>width+margin||Math.max(a.y,b.y)<-margin||Math.min(a.y,b.y)>height+margin);
}
/** Panel accommodation translates the camera; its zoom is never a fit result. */
export function accommodate(camera:Camera,anchor:{x:number;y:number},region:{x:number;y:number;width:number;height:number},extent:{width:number;height:number}):Camera {
  return {zoom:camera.zoom,x:camera.x+region.x+region.width/2-extent.width/2+(400-anchor.x)*camera.zoom,y:camera.y+region.y+region.height/2-extent.height/2+(260-anchor.y)*camera.zoom};
}
export function unaccommodate(camera:Camera,anchor:{x:number;y:number},region:{x:number;y:number;width:number;height:number},extent:{width:number;height:number}):Camera {
  const offset=accommodate({x:0,y:0,zoom:camera.zoom},anchor,region,extent);
  return {...camera,x:camera.x-offset.x,y:camera.y-offset.y};
}
