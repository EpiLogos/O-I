export interface NavigationCamera {x:number;y:number;zoom:number}
export interface NavigationPoint {id:string;x:number;y:number;hollow?:boolean;width?:number;height?:number}
export interface NavigationExtent {width:number;height:number}
export interface NavigationProjection {scale:number;offset:{x:number;y:number};bounds:{left:number;top:number;right:number;bottom:number}}
export function projectNavigationMinimap(points:readonly NavigationPoint[],extent:NavigationExtent,padding=8):NavigationProjection|null {
 const actual=points.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y));
 if(!actual.length||!Number.isFinite(extent.width)||!Number.isFinite(extent.height)||extent.width<=padding*2||extent.height<=padding*2)return null;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const point of actual){const w=Number.isFinite(point.width)&&point.width!>0?point.width!/2:0,h=Number.isFinite(point.height)&&point.height!>0?point.height!/2:0;left=Math.min(left,point.x-w);right=Math.max(right,point.x+w);top=Math.min(top,point.y-h);bottom=Math.max(bottom,point.y+h);}
 const width=Math.max(1,right-left),height=Math.max(1,bottom-top),scale=Math.min((extent.width-padding*2)/width,(extent.height-padding*2)/height);
 return {scale,offset:{x:extent.width/2-(left+right)*scale/2,y:extent.height/2-(top+bottom)*scale/2},bounds:{left,top,right,bottom}};
}
export function navigationMinimapPoint(point:{x:number;y:number},projection:NavigationProjection){return {x:projection.offset.x+point.x*projection.scale,y:projection.offset.y+point.y*projection.scale};}
/** The affine origin differs between the native graph (400,260 at screen
 * centre) and Canvas (0,0 at screen origin). Both consume the same model. */
export function navigationViewport(camera:NavigationCamera,extent:NavigationExtent,origin:{x:number;y:number},screenOrigin:{x:number;y:number}) {
 if(![camera.x,camera.y,camera.zoom,extent.width,extent.height,origin.x,origin.y,screenOrigin.x,screenOrigin.y].every(Number.isFinite)||camera.zoom<=0||extent.width<0||extent.height<0)throw Error('A minimap needs a finite captured native viewport');
 return {left:origin.x-(screenOrigin.x+camera.x)/camera.zoom,top:origin.y-(screenOrigin.y+camera.y)/camera.zoom,width:extent.width/camera.zoom,height:extent.height/camera.zoom};
}
export function navigationCameraAt(point:{x:number;y:number},projection:NavigationProjection,camera:NavigationCamera,extent:NavigationExtent,origin:{x:number;y:number},screenOrigin:{x:number;y:number}):NavigationCamera {
 navigationViewport(camera,extent,origin,screenOrigin);
 if(![point.x,point.y,projection.scale].every(Number.isFinite)||projection.scale<=0)throw Error('Choose a finite position in the native minimap');
 const world={x:(point.x-projection.offset.x)/projection.scale,y:(point.y-projection.offset.y)/projection.scale};
 return {zoom:camera.zoom,x:extent.width/2-screenOrigin.x+(origin.x-world.x)*camera.zoom,y:extent.height/2-screenOrigin.y+(origin.y-world.y)*camera.zoom};
}
