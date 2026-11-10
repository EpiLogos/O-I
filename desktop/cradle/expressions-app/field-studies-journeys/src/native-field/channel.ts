import {fromHost,postToHost} from '../hostChannel';
const SCHEMA='oi.native-expression/v1';
/** One native compose runs the installed ql-sky and `ql scene binding` inside
 * the kernel's own budgets (sky 120 s, binding 30 s); under load it answers
 * well past an ordinary acknowledgement ceiling. Abandoning it mid-flight does
 * not cancel the kernel work: the driver then opens to nobody and the surface
 * stays owned. The compose therefore carries its own ceiling. */
export const COMPOSE_TIMEOUT_MS=105000;
export interface NativePort {request(request:unknown,timeoutMs?:number):Promise<any>;dispose():void;readonly available:boolean;onHold?:(reason:string)=>void;onVisibility?:(visible:boolean)=>void;beat?():void}
/** The field the kernel relayed this frame last, whole or made whole, and the request that acknowledged it (round 54 item 1, O-I #821). */
export interface RelayedField {readonly request_id:string;readonly field:any}
/** A field the kernel relayed as what changed since the one it relayed this frame last (kernel native_expression.rs `field_delta`,
 * `oi.native-field-delta/v1`; round 54 item 1, O-I #821), made whole on `relayed`: the keys removed and changed, the entries of a list
 * that moved, and every target's position, three little-endian f32 for each, in order. A change from any other field than `relayed`, or
 * one that does not arrive at the cursor it names, is never drawn from: null, and the frame asks the owner's whole field. */
export function applyFieldDelta(relayed:RelayedField|null,delta:any):any|null{
 const base=relayed?.field;
 if(!base||delta?.schema!=='oi.native-field-delta/v1'||delta.base_request_id!==relayed!.request_id||delta.base_generation!==base.generation
  ||delta.base_samples_elapsed!==base.samples_elapsed)return null;
 if(!Array.isArray(delta.removed)||!delta.changed||typeof delta.changed!=='object'||!delta.items||typeof delta.items!=='object')return null;
 const field:any={...base};
 for(const key of delta.removed)delete field[key];
 for(const [key,value] of Object.entries(delta.changed))field[key]=value;
 for(const [key,moved] of Object.entries(delta.items as Record<string,unknown>)){
  if(!Array.isArray(base[key])||!Array.isArray(moved))return null;
  const now=base[key].slice();
  for(const entry of moved){if(!Array.isArray(entry)||!Number.isInteger(entry[0])||entry[0]<0||entry[0]>=now.length)return null;now[entry[0]]=entry[1];}
  field[key]=now;
 }
 if(delta.positions!==undefined){
  const targets=field.targets;
  if(typeof delta.positions!=='string'||!Array.isArray(targets))return null;
  const text=atob(delta.positions),bytes=new Uint8Array(text.length);
  for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
  if(bytes.length!==targets.length*12)return null;
  const view=new DataView(bytes.buffer),at=(i:number)=>view.getFloat32(i*4,true);
  field.targets=targets.map((target:any,i:number)=>({...target,position:[at(3*i),at(3*i+1),at(3*i+2)]}));
 }
 return field.generation===delta.generation&&field.samples_elapsed===delta.samples_elapsed?field:null;
}
/** A fresh epoch is required after reload; stale completions cannot bind a new app. */
export class NativeChannel implements NativePort {
 private epoch:string|null=null; private seq=0; private dead=false; available=false;
 onHold?:(reason:string)=>void;
 /** The host showed or hid this frame's surface. */
 onVisibility?:(visible:boolean)=>void;
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:number}>();
 constructor(){window.addEventListener('message',this.message);postToHost({schema:SCHEMA,kind:'hello'});}
 /** Whether the host has answered the channel at all, available or not (walk #857: the Live entry waits for this before it opens). */
 get answered(){return this.epoch!==null;}
 private rejectAll(reason:string){for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error(reason));}this.pending.clear();}
 private message=(event:MessageEvent)=>{
  if(this.dead || !fromHost(event) || event.data?.schema!==SCHEMA)return;
  const data=event.data;
  if(data.kind==='available' && typeof data.epoch==='string'){
   if(this.epoch && data.epoch!==this.epoch){this.rejectAll('host epoch changed; native continuation unavailable');this.onHold?.('host epoch changed');}
   this.epoch=data.epoch;this.available=data.available===true;return;
  }
  if(data.epoch!==this.epoch)return;
  // The host's surface shown or hidden (Pane view left for Session view, Torus Full, another tab) pauses drawing only: the field, its audio
  // receiver, keys, strikes, clip play and Record go on, as Live's instruments play with their device view closed (DLW build ruling
  // 2026-11-07, G4 of the walk of O-I 857). Only the person's own hold holds the field.
  if(data.kind==='visibility'){if(typeof data.visible==='boolean')this.onVisibility?.(data.visible);return;}
  if(data.kind!=='result')return;
  const pending=this.pending.get(data.req);if(!pending)return;
  this.pending.delete(data.req);clearTimeout(pending.timer);
  if(data.ok===true)pending.resolve(data.data);else pending.reject(new Error(typeof data.error==='string'?data.error:'native operation refused'));
 };
 request(request:unknown,timeoutMs=15000):Promise<any>{
  if(this.dead || !this.epoch || !this.available)return Promise.reject(new Error('Native QL host channel unavailable. Ordinary Expressions remains usable.'));
  const req=++this.seq;
  return new Promise((resolve,reject)=>{
   const timer=window.setTimeout(()=>{this.pending.delete(req);this.onHold?.('native acknowledgement unknown; not retried');reject(new Error('native acknowledgement timed out; not retried'));},timeoutMs);
   this.pending.set(req,{resolve,reject,timer});postToHost({schema:SCHEMA,epoch:this.epoch,req,kind:'request',request});
  });
 }
 /** The driver's holder still answers (DLW build ruling 2026-11-07, G2): the frame's readback tick says so to its host, which beats the
  * kernel under its own lease. Answered to nobody; never a hold. */
 beat(){if(this.dead || !this.epoch || !this.available)return;postToHost({schema:SCHEMA,epoch:this.epoch,kind:'beat'});}
 dispose(){if(this.dead)return;if(this.epoch)postToHost({schema:SCHEMA,epoch:this.epoch,kind:'dispose'});this.dead=true;this.available=false;this.rejectAll('native channel disposed');window.removeEventListener('message',this.message);}
}
