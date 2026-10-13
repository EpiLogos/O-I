import {baseValue,entityTargets,nativeBinding} from './nativeParameters';
import {clone,Scene,Journey} from './model';
/** Segment law from a point to the next one. Absent = linear (legacy behaviour, byte-identical). */
export type Interpolation='linear'|'hold'|'smooth'|'bezier';
/** Bezier handle, relative to its own point: `out` on point i (dt in [0,span]), `in` on point i+1 (dt in [-span,0]). */
export interface Handle{dt:number;dv:number}
export interface PropertyTrack {id:string;bind:string;entityId?:string;points:Array<{time:number;value:number;type?:Interpolation;out?:Handle;in?:Handle}>}
const interpolations=new Set<unknown>(['linear','hold','smooth','bezier']);
const safePath=/^(field\.params\.[A-Za-z0-9_]+|entity\.(position\.[xyz]|scale|tintWeight|force\.(strength|radius|spin)|sequence\.(hold|transition|rateMul|phaseOffset)))$/;
export function validateTracks(value:unknown):PropertyTrack[]{if(!Array.isArray(value)||value.length>2048)throw new Error('Invalid property tracks');const ids=new Set<string>(),targets=new Set<string>();for(const t of value){if(!t||typeof t.id!=='string'||(!safePath.test(t.bind)||t.bind.split('.').some((k:string)=>['__proto__','prototype','constructor'].includes(k)))||t.bind.startsWith('entity.')&&typeof t.entityId!=='string'||!Array.isArray(t.points)||t.points.length>72000)throw new Error('Invalid property track');const target=t.bind+':'+(t.entityId??'');if(ids.has(t.id)||targets.has(target))throw new Error('Duplicate property track');ids.add(t.id);targets.add(target);let last=-1;for(const p of t.points){if(!p||!Number.isFinite(p.time)||p.time<0||p.time>3600||p.time<=last||!Number.isFinite(p.value))throw new Error('Invalid property keyframe');if(p.type!==undefined&&!interpolations.has(p.type))throw new Error('Invalid property keyframe interpolation');for(const h of [p.out,p.in])if(h!==undefined&&(!h||!Number.isFinite(h.dt)||!Number.isFinite(h.dv)))throw new Error('Invalid property keyframe handle');last=p.time;}}return clone(value);}
type KeyPoint=PropertyTrack['points'][number];
/** One segment a→b. The linear arm is the legacy valueAt expression, unchanged in operand order. */
function segmentValue(a:KeyPoint,b:KeyPoint,time:number):number{
  switch(a.type){
    case 'hold':return a.value;
    case 'smooth':{const s=(time-a.time)/(b.time-a.time);return a.value+(b.value-a.value)*(s*s*(3-2*s));}
    case 'bezier':return bezierValue(a,b,time);
    default:return a.value+(b.value-a.value)*(time-a.time)/(b.time-a.time);
  }
}
/** A control point of a segment's cubic in (time, value). */
export type CurvePoint={x:number;y:number};
/** The four control points of segment a→b. Absent handles sit at the thirds (a handle-less bezier is linear); a smooth
 * segment is the bezier with flat handles at the thirds (x linear, y smoothstep). Control times are clamped inside the
 * segment and kept non-decreasing, so time is monotone in the parameter. One definition, used by evaluation and by the
 * E07 split (which subdivides on the same curve). */
export function segmentControls(a:KeyPoint,b:KeyPoint,smooth=false):[CurvePoint,CurvePoint,CurvePoint,CurvePoint]{
  const span=b.time-a.time,rise=b.value-a.value;
  const o=smooth?{dt:span/3,dv:0}:(a.out??{dt:span/3,dv:rise/3});
  const n=smooth?{dt:-span/3,dv:0}:(b.in??{dt:-span/3,dv:-rise/3});
  const x1=a.time+Math.min(span,Math.max(0,o.dt)),x2=Math.max(x1,b.time+Math.max(-span,Math.min(0,n.dt)));
  return [{x:a.time,y:a.value},{x:x1,y:a.value+o.dv},{x:x2,y:b.value+n.dv},{x:b.time,y:b.value}];
}
const cubic=(p0:number,p1:number,p2:number,p3:number,u:number)=>{const v=1-u;return v*v*v*p0+3*v*v*u*p1+3*v*u*u*p2+u*u*u*p3;};
/** The curve parameter at which the time column reaches t (64-step bisection). */
export function curveParameter(c:readonly [CurvePoint,CurvePoint,CurvePoint,CurvePoint],t:number):number{
  let lo=0,hi=1;
  for(let k=0;k<64;k++){const mid=(lo+hi)/2;if(cubic(c[0].x,c[1].x,c[2].x,c[3].x,mid)<t)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
/** Cubic Bezier in (time, value), solved for time by bisection. */
function bezierValue(a:KeyPoint,b:KeyPoint,time:number):number{
  if(time<=a.time)return a.value;
  const c=segmentControls(a,b);
  return cubic(c[0].y,c[1].y,c[2].y,c[3].y,curveParameter(c,time));
}
export function valueAt(points:PropertyTrack['points'],time:number):number|undefined{if(!points.length||time<points[0].time)return undefined;let i=points.findIndex(p=>p.time>time);if(i<0)return points.at(-1)!.value;return segmentValue(points[i-1],points[i],time);}
export function readTrackValue(s:Scene,t:Pick<PropertyTrack,'bind'|'entityId'>):number|undefined{if(t.bind.startsWith('field.params.')){const key=t.bind.slice(13);if(nativeBinding(key))return baseValue(s,key);}if(t.bind.startsWith('entity.')){const target=entityTargets(s).find(v=>v.entityId===t.entityId&&v.bind===t.bind);if(target)return target.value;}const root=t.bind.startsWith('entity.')?s.entities.find(e=>e.id===t.entityId):s;const path=t.bind.startsWith('entity.')?t.bind.slice(7):t.bind;let value:any=root;for(const key of path.split('.'))value=value?.[key];return typeof value==='number'&&Number.isFinite(value)?value:undefined;}
export function evaluateTracks(s:Scene,time:number):Scene{if(!s.propertyTracks?.length)return s;const out:Scene={...s,field:{...s.field,params:{...s.field.params}},entities:s.entities.map(e=>({...e,position:{...e.position},size:{...e.size},force:{...e.force},sequence:{...e.sequence}}))};for(const t of out.propertyTracks!){const value=valueAt(t.points,time);if(value===undefined)continue;let root:any=t.bind.startsWith('entity.')?out.entities.find(e=>e.id===t.entityId):out;const keys=(t.bind.startsWith('entity.')?t.bind.slice(7):t.bind).split('.');for(const k of keys.slice(0,-1))root=root?.[k];if(root&&readTrackValue(s,t)!==undefined){const binding=t.bind.startsWith('field.params.')?nativeBinding(t.bind.slice(13)):entityTargets(s).find(v=>v.entityId===t.entityId&&v.bind===t.bind);root[keys.at(-1)!]=binding?Math.max(binding.hardMin,Math.min(binding.hardMax,value)):value;}}return out;}
export function mergeTake(existing:PropertyTrack[],take:PropertyTrack[],start:number,end:number):PropertyTrack[]{const out=clone(existing);for(const t of take){const old=out.find(v=>v.bind===t.bind&&v.entityId===t.entityId);if(!old){out.push(clone(t));continue;}const points=old.points.filter(p=>p.time<start||p.time>end);old.points=[...points,...clone(t.points)].sort((a,b)=>a.time-b.time);}return out;}
export function expressionTiming(j:Journey,index:number,local:number,savedOnly=false){const duration=(s:Scene)=>savedOnly?(j.savedScenes?.[s.id]?.duration??0):s.duration;const total=j.scenes.reduce((n,s)=>n+duration(s),0),start=j.scenes.slice(0,index).reduce((n,s)=>n+duration(s),0);return {start,total,time:Math.min(total,start+local)};}

/** Keep held values flat until the gesture starts; do not invent a long ramp. */
export function sampleTrack(track:PropertyTrack,time:number,value:number,previousTime:number){const last=track.points.at(-1);if(!last){track.points.push({time:previousTime,value});return;}if(last.value===value)return;if(previousTime>last.time)track.points.push({time:previousTime,value:last.value});if(time>track.points.at(-1)!.time)track.points.push({time,value});}
