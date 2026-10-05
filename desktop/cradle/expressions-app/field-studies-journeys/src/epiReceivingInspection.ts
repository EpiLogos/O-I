/** On-demand observation of this receiver; no engine/native operation or private
 * body leaves this projection. Scalar snapshots do not prove causal actuation. */
import {MAX_FORMATIONS} from '../../src/engine/fieldModel';
import {RESONATOR_MODE_TOTAL} from '../../src/engine/cymaticResonator';
import type {LocalizedResonanceProjection} from '../../src/engine/localizedResonanceProjection';
export type EpiReceivingInspection=Record<string,unknown>;
function need(ok:unknown,why:string):asserts ok{if(!ok)throw Error('Receiving Inspect: '+why);}
const number=(v:unknown,label:string)=>{need(typeof v==='number'&&Number.isFinite(v),label+' is not finite');return v as number;};
const integer=(v:unknown,label:string)=>{const n=number(v,label);need(Number.isSafeInteger(n)&&n>=0,label+' is not a nonnegative integer');return n;};
const text=(v:unknown,label:string)=>{need(typeof v==='string'&&v.length>0&&v.length<=8192,label+' is absent or oversized');return v as string;};
const object=(v:unknown,label:string)=>{need(!!v&&typeof v==='object'&&!Array.isArray(v),label+' is not an object');return v as Record<string,unknown>;};
const array=(v:unknown,max:number,label:string)=>{need(Array.isArray(v)&&v.length<=max,label+' exceeds the existing receiver bound');return v as unknown[];};
function vector(v:unknown,n:number,label:string){
 const values=array(v,n,label);need(values.length===n,label+' is not the complete actual readback');
 for(const value of values)number(value,label);return values as number[];
}
/** Borrow the existing full inspect(true) result, emit no particles/modal planes. */
export function inspectReceivingScalars(raw:unknown,required:readonly string[],expected:LocalizedResonanceProjection|null,baseDrive:unknown){
 const r=object(raw,'engine readback'),count=integer(r.particleCount,'particle count');
 const positions=vector(r.positions,count*4,'GPU positions'),velocities=vector(r.velocities,count*4,'GPU velocities'),targets=vector(r.targets,count*4,'transformed targets');
 const partitions=array(r.partitions,MAX_FORMATIONS,'partitions').map(value=>{
  const p=object(value,'partition'),start=integer(p.start,'partition start'),end=integer(p.end,'partition end');
  need(start<=end&&end<=count,'partition lies outside the actual GPU readback');return {entityId:text(p.entityId,'partition entity'),start,end,count:end-start};
 });
 let maxSpeed=0,speedSum=0,maxTargetGap=0,targetGapSum=0;
 for(let i=0;i<count;i++){
  let speed2=0,gap2=0;for(let axis=0;axis<3;axis++){speed2+=velocities[i*4+axis]**2;gap2+=(positions[i*4+axis]-targets[i*4+axis])**2;}
  const speed=Math.sqrt(speed2),gap=Math.sqrt(gap2);maxSpeed=Math.max(maxSpeed,speed);speedSum+=speed;maxTargetGap=Math.max(maxTargetGap,gap);targetGapSum+=gap;
 }
 const frames=array(r.localizedResonance,MAX_FORMATIONS,'localized modal frames').map(value=>{
  const f=object(value,'localized modal frame'),params=object(f.params,'modal parameters'),re=vector(f.re,RESONATOR_MODE_TOTAL,'modal real plane'),im=vector(f.im,RESONATOR_MODE_TOTAL,'modal imaginary plane');
  const drive=number(params.driveStrength,'modal excitation'),frequencyHz=number(f.frequencyHz,'modal frequency');
  need(drive>=0&&frequencyHz>0,'invalid modal excitation/frequency');
  const driverRef=f.driverRef===undefined?null:text(f.driverRef,'native driver'),entityId=text(f.entityId,'modal target');
  let energy=0;for(let i=0;i<re.length;i++)energy+=re[i]**2+im[i]**2;
  const admitted=expected?.drivers.find(row=>(row.driverRef??null)===driverRef);
  const matches=!!admitted&&admitted.entityId===entityId&&admitted.frequencyHz===frequencyHz&&typeof baseDrive==='number'&&Number.isFinite(baseDrive)&&drive===baseDrive*admitted.driveShare;
  return {driverRef,entityId,frequencyHz,excitation:drive,excitation_state:drive===0?'zero':'positive',modal_slots:re.length,modal_energy:number(energy,'modal energy'),matches_admitted_native_driver:matches};
 });
 const actualIds=new Set(partitions.filter(p=>p.count>0).map(p=>p.entityId));
 return {simTime:number(r.simTime,'engine time'),steps:integer(r.steps,'engine steps'),seeds:integer(r.seeds,'engine seeds'),bakes:integer(r.bakes,'engine bakes'),particleCount:count,
  partitions,required_body_count:required.length,all_required_bodies_nonempty:required.length>0&&partitions.length===required.length&&new Set(partitions.map(p=>p.entityId)).size===partitions.length&&required.every(id=>actualIds.has(id)),
  GPU_readback:{complete:true,finite:true,max_speed:maxSpeed,mean_speed:count?speedSum/count:0,max_target_gap:maxTargetGap,mean_target_gap:count?targetGapSum/count:0},
  modal_receiving:{actual_driver_count:frames.length,distinct_driver_count:new Set(frames.map(f=>f.driverRef)).size,distinct_target_count:new Set(frames.map(f=>f.entityId)).size,
   admitted_driver_count:expected?.drivers.length??null,complete_admitted_driver_match:!!expected&&expected.drivers.length>0&&frames.length===expected.drivers.length&&new Set(frames.map(f=>f.driverRef)).size===frames.length&&frames.every(f=>f.driverRef!==null&&f.matches_admitted_native_driver)&&expected.drivers.every(driver=>frames.some(f=>f.driverRef===driver.driverRef)),frames},
  standing:'Actual instantaneous GPU readback and resident modal scalar observations; no intervention, causal comparison, audible output or visible shape acceptance'};
}
function route(url:string){const value=new URL(url,location.href);return {origin:value.origin,pathname:value.pathname};}
export function receivingEnvironment(canvas:HTMLCanvasElement){
 // inspect(true) must already have returned this initialized production engine.
 // Reusing its WebGL context reads parameters; it creates no new renderer/lease.
 const gl=canvas.getContext('webgl2');need(gl&&!gl.isContextLost(),'the current production WebGL context is unavailable or lost');
 const resources=performance.getEntriesByType('resource').filter(entry=>/\.(?:m?js)(?:$|[?#])/.test(entry.name));
 return {frame:route(location.href),executing_inspection_module:route(import.meta.url),viewport:{width:innerWidth,height:innerHeight,pixel_ratio:devicePixelRatio},visibility:document.visibilityState,
  reduced_motion:matchMedia('(prefers-reduced-motion: reduce)').matches,user_agent:navigator.userAgent,
  context:gl?{lost:gl.isContextLost(),version:String(gl.getParameter(gl.VERSION)),renderer:String(gl.getParameter(gl.RENDERER)),vendor:String(gl.getParameter(gl.VENDOR))}:null,
  observed_script_resources:resources.slice(0,48).map(entry=>route(entry.name)),observed_script_count:resources.length,resource_list_complete:resources.length<=48,
  module_custody:'Resource URLs observed by this iframe, without query/fragment. They do not prove executed import bytes, compiled source cut, native binary image, or installed bundle hash'};
}
export function receivingWitness(value:EpiReceivingInspection){
 const encoded=JSON.stringify(value,null,2);
 // This is a disclosure budget, not a raised document/private-current carrier.
 need(new TextEncoder().encode(encoded).byteLength<=65536,'bounded scalar disclosure exceeds 64 KiB');return value;
}
