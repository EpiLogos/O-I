/** A touch on the torus (DLW §21.2 "What strikes the Torus": "A touch | The point of the surface you touch"; Full: "Touch the surface
 * and it rings"). The point of the surface under the pointer, as the torus's own angles, for the owner's strike at a point (QL-MEF #342
 * `strike-at`, InstrumentSession.strikeAt): theta the poloidal (tube) angle and phi the toroidal (ring) angle, each on the sampled sheet
 * [0, 2π).
 *
 * The frame names the point only from its own drawing of the stage. The engine is handed an orthographic view (production.ts
 * setHostView: the stage centre and pan as the origin, stageScale × zoom pixels per stage unit, camera.ts `basis` as right and up, the
 * eye along right × up), so the pixel under the pointer is a ray along −(right × up). That ray, carried into metres, meets QL's torus at
 * its first surface. The body vibrates along its normal (QL scene_field.rs `surface`), which keeps a point's angles, so the rest torus
 * names the point the person sees. Pure: no DOM, no engine, no owner. */
import {basis,stageCentre,stageScale,type Camera} from '../camera';

/** QL's M1 torus (QL-MEF crates/ql-mef/src/m1.rs `torus`, coordinate #1-5-1; the shell's live/torusInstrument.ts LIVE_TORUS_TOPOLOGY):
 * x = (R + cos θ) cos φ, y = (R + cos θ) sin φ, z = sin θ, with R = 16/9 and r = 1, in metres. */
export const TORUS_MAJOR_METRES=16/9;
export const TORUS_MINOR_METRES=1;
const TAU=2*Math.PI;
export type Vec3=[number,number,number];
/** A point of the torus by its own angles, each on the sheet [0, 2π). */
export interface SurfacePoint {theta:number;phi:number}
/** The stage a touch lands on: the frame's camera and the stage's size in pixels. */
export interface StageView {camera:Camera;width:number;height:number}
/** How the stage is drawn: the engine's projection, the owner's presentation scale and the frame's engine units per stage unit. */
export interface StageScale {projection:'orthographic'|'perspective';unitsPerMetre:number;worldScale:number}
export type TouchReading={point:SurfacePoint;at:Vec3}|{point:null;why:string};

/** QL's m1::torus at (theta, phi). */
export function torusPoint(theta:number,phi:number):Vec3 {
 const radius=TORUS_MAJOR_METRES+Math.cos(theta);
 return [radius*Math.cos(phi),radius*Math.sin(phi),Math.sin(theta)];
}

/** An angle on the sheet [0, 2π): never 2π itself, which strike-at refuses. */
const onSheet=(angle:number)=>{const a=(angle%TAU+TAU)%TAU;return a>=TAU?0:a;};

/** The angles of a point on (or moved along a normal of) the torus: the inverse of m1::torus. Null on the ring's core circle and on the
 * axis, where the angles are not defined. */
export function surfaceAngles(point:Vec3):SurfacePoint|null {
 const [x,y,z]=point,rho=Math.hypot(x,y),across=rho-TORUS_MAJOR_METRES;
 if(!(rho>0)||!(Math.hypot(across,z)>0))return null;
 return {theta:onSheet(Math.atan2(z,across)),phi:onSheet(Math.atan2(y,x))};
}

/** The signed distance from a point to the torus surface, exact (so a march along a ray never steps through it). */
const distance=(p:Vec3)=>Math.hypot(Math.hypot(p[0],p[1])-TORUS_MAJOR_METRES,p[2])-TORUS_MINOR_METRES;
const BOUND=TORUS_MAJOR_METRES+TORUS_MINOR_METRES;

/** The least step of the march, in metres: a hundredth of a millimetre, far under a pixel of the stage. A ray whose path inside the
 * tube is shorter than this only grazes the surface, and is no hit. */
const LEAST_STEP=1e-4;

/** The first point at which a ray (origin, direction, in metres) meets the torus, or null when it meets none. The march starts where the
 * ray enters the torus's bounding sphere and steps by the exact distance to the surface (never less than LEAST_STEP), so it never steps
 * over a surface it could reach; the step that crosses into the tube is then halved down to the surface. The first surface reached is
 * the one returned. */
export function rayHit(origin:Vec3,direction:Vec3):{t:number;point:Vec3}|null {
 const length=Math.hypot(...direction);
 if(!(length>0))return null;
 const d:Vec3=[direction[0]/length,direction[1]/length,direction[2]/length];
 const at=(t:number):Vec3=>[origin[0]+d[0]*t,origin[1]+d[1]*t,origin[2]+d[2]*t];
 const b=origin[0]*d[0]+origin[1]*d[1]+origin[2]*d[2],c=origin[0]**2+origin[1]**2+origin[2]**2-BOUND*BOUND,disc=b*b-c;
 if(disc<0)return null;
 const exit=-b+Math.sqrt(disc);
 if(exit<0)return null;
 let t=Math.max(0,-b-Math.sqrt(disc)),gap=distance(at(t));
 if(gap<=0)return {t,point:at(t)};
 while(t<=exit){
  const next=t+Math.max(gap,LEAST_STEP),ahead=distance(at(next));
  if(ahead<=0){
   let outside=t,inside=next;
   for(let halving=0;halving<64;halving++){const mid=(outside+inside)/2;if(distance(at(mid))>0)outside=mid;else inside=mid;}
   return {t:inside,point:at(inside)};
  }
  t=next;gap=ahead;
 }
 return null;
}

/** The surface point under a pointer at (x, y) on the stage, or why there is none. */
export function touchedSurface(x:number,y:number,view:StageView,scale:StageScale):TouchReading {
 if(!Number.isFinite(scale.unitsPerMetre)||scale.unitsPerMetre<=0||!Number.isFinite(scale.worldScale)||scale.worldScale<=0)
  throw new Error('a touch needs the presentation\'s units per metre and the stage\'s engine units per stage unit');
 // The engine's perspective eye frames the stage by its own field of view (PointCloudField setHostView), not by the frame's
 // projection, so the frame cannot name the touched point exactly there. It refuses rather than guess.
 if(scale.projection==='perspective')return {point:null,why:'The stage is drawn in perspective; a touch strikes the torus only on the flat (orthographic) stage, where the point under the pointer is exact.'};
 const {camera,width,height}=view,{a,b}=basis(camera),o=stageCentre(width,height),pixels=stageScale(width,height)*camera.zoom;
 if(!(pixels>0))return {point:null,why:'The stage has no size yet.'};
 // camera.ts `unproject` and `project`: the pixel's place across the stage in stage units, then in metres.
 const across=(x-o.x-camera.panX)/pixels,up=-(y-o.y-camera.panY)/pixels,metres=scale.worldScale/scale.unitsPerMetre;
 const toward:Vec3=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const plane:Vec3=[0,1,2].map(i=>(across*a[i]+up*b[i])*metres) as Vec3;
 // The eye stands along right × up (setHostView), so the ray starts beyond the torus on that side and looks back along −(right × up).
 const origin:Vec3=[0,1,2].map(i=>plane[i]+toward[i]*2*BOUND) as Vec3;
 const hit=rayHit(origin,[-toward[0],-toward[1],-toward[2]]);
 const point=hit?surfaceAngles(hit.point):null;
 if(!hit||!point)return {point:null,why:'No surface of the torus is under the pointer.'};
 return {point,at:hit.point};
}

/** The live instrument as a touch reads it: the controller's reading (controller.ts `reading`). */
export interface TouchInstrument {status?:string;instrument?:unknown;presentation_units_per_metre?:number|null}
/** What a press strikes: the touched point and its impulse (undefined: the owner's default strike, controller.ts playAt), or why the
 * press is no touch. `say` is whether the person pressed the playing torus and should be told why it did not ring. */
export type TouchStrike={point:SurfacePoint;amplitude:number|undefined}|{point:null;why:string;say:boolean};

/** What a press at (x, y) on the stage strikes while the live instrument stands as `reading`. Only a running field takes a touch, as
 * only a running field takes a key; a press while no instrument plays, or off the torus, is no touch and the stage keeps it. Pen
 * pressure strikes as it does on the Jankó keys (nativeField.ts pressKey: 0.9 × pressure, held to 0.15–0.9). */
export function touchStrike(reading:TouchInstrument|null|undefined,x:number,y:number,view:StageView,
 stage:{projection:StageScale['projection'];worldScale:number;pressure?:number}):TouchStrike {
 const unitsPerMetre=reading?.presentation_units_per_metre;
 if(!reading?.instrument||reading.status!=='following'||!(typeof unitsPerMetre==='number'&&unitsPerMetre>0))
  return {point:null,why:'The live instrument is not playing.',say:false};
 const touched=touchedSurface(x,y,view,{projection:stage.projection,unitsPerMetre,worldScale:stage.worldScale});
 if(!touched.point)return {point:null,why:touched.why,say:stage.projection==='perspective'};
 const pressure=stage.pressure;
 return {point:touched.point,amplitude:typeof pressure==='number'&&pressure>0?Math.min(0.9,Math.max(0.15,pressure*0.9)):undefined};
}
