import {Plane,Vec3} from './model.js';
export interface Camera {mode:'2d'|'3d';yaw:number;pitch:number;zoom:number;panX:number;panY:number;plane:Plane;depth:number;grid:boolean;snap:boolean}
export const defaultCamera=():Camera=>({mode:'2d',yaw:0,pitch:0,zoom:1,panX:0,panY:0,plane:'XY',depth:0,grid:false,snap:false});
export function basis(c:Camera){const y=c.yaw,p=c.pitch;return {a:[Math.cos(y),0,Math.sin(y)],b:[Math.sin(y)*Math.sin(p),Math.cos(p),-Math.cos(y)*Math.sin(p)]};}
export function stageScale(w:number,h:number){return Math.min(w*.435,h*.465);}
export function stageCentre(w:number,h:number){return {x:w*.51,y:h*(w<650?.385:.48)};}
export function project(v:Vec3,c:Camera,w:number,h:number){const {a,b}=basis(c),s=stageScale(w,h)*c.zoom,o=stageCentre(w,h);return {x:o.x+c.panX+s*(a[0]*v.x+a[1]*v.y+a[2]*v.z),y:o.y+c.panY-s*(b[0]*v.x+b[1]*v.y+b[2]*v.z)};}
/** Orthographic ray / explicit construction-plane intersection. Throws on edge-on planes. */
export function unproject(x:number,y:number,c:Camera,w:number,h:number,plane:Plane=c.plane,depth=c.depth):Vec3 {
 const {a,b}=basis(c),s=stageScale(w,h)*c.zoom,o=stageCentre(w,h),px=(x-o.x-c.panX)/s,py=-(y-o.y-c.panY)/s;
 const axes=plane==='XY'?[0,1,2]:plane==='XZ'?[0,2,1]:[1,2,0];const [i,j,k]=axes;
 const X=px-a[k]*depth,Y=py-b[k]*depth,det=a[i]*b[j]-a[j]*b[i];
 if(Math.abs(det)<.035)throw new Error('This working plane is edge-on. Choose “Face plane” before placing.');
 const v=[0,0,0];v[k]=depth;v[i]=(X*b[j]-a[j]*Y)/det;v[j]=(a[i]*Y-X*b[i])/det;
 if(c.snap){v[i]=Math.round(v[i]*10)/10;v[j]=Math.round(v[j]*10)/10;}
 return{x:v[0],y:v[1],z:v[2]};
}
export function facePlane(c:Camera){if(c.plane==='XY'){c.yaw=0;c.pitch=0;}if(c.plane==='XZ'){c.yaw=0;c.pitch=-Math.PI/2;}if(c.plane==='YZ'){c.yaw=Math.PI/2;c.pitch=0;}}
