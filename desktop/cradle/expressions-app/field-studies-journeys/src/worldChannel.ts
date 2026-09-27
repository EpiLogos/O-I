/** The hosted frame's face of the Expression-world seam (acts, reusable
 * material): `{v:1, kind:'kernel-expression-world', req, request}` posted to
 * the cradle host, answered `{v:1, kind:'kernel-expression-world-result',
 * req, ok, data|error}` (relay: desktop/cradle/src/expressions/hostedApp.ts).
 * Shapes are the kernel contract (desktop/cradle/src/expression/world.ts,
 * docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §4). Nothing here holds
 * authority: the frame asks, the host's kernel answers. */
import {kernelExpressionsAvailable} from './kernelExpressions.js';

const VERSION=1,KIND='kernel-expression-world';
type Pending={resolve:(value:unknown)=>void;reject:(cause:Error)=>void;timer:number};
const pending=new Map<number,Pending>();
// A distinct request range: the Expression channel counts from 1 and replies
// are matched by kind as well, so the two never collide.
let seq=1_000_000,installed=false;

function onMessage(ev:MessageEvent){
 if(ev.source!==window.parent)return;
 const d=ev.data as {v?:unknown;kind?:unknown;req?:unknown;ok?:unknown;data?:unknown;error?:unknown}|null;
 if(!d||d.v!==VERSION||d.kind!==`${KIND}-result`||typeof d.req!=='number')return;
 const entry=pending.get(d.req);if(!entry)return;
 pending.delete(d.req);clearTimeout(entry.timer);
 if(d.ok===true)entry.resolve(d.data);
 else entry.reject(new Error(typeof d.error==='string'&&d.error?d.error:'the Expression world refused the request'));
}

/** True inside the desktop shell once the host announced its kernel channel. */
export function worldAvailable():boolean{
 return typeof window!=='undefined'&&window.parent!==window&&kernelExpressionsAvailable();
}

/** One world operation through the host relay. */
export function worldRequest<T=Record<string,unknown>>(request:{operation:string;[key:string]:unknown},timeoutMs=20000):Promise<T>{
 if(!worldAvailable())return Promise.reject(new Error('Acts and reusable material need the desktop shell (the kernel host channel is not available).'));
 if(!installed){installed=true;window.addEventListener('message',onMessage);}
 const req=++seq;
 return new Promise<T>((resolve,reject)=>{
  const timer=window.setTimeout(()=>{pending.delete(req);reject(new Error(`the host did not answer the ${request.operation} world request`));},timeoutMs);
  pending.set(req,{resolve:v=>resolve(v as T),reject,timer});
  window.parent.postMessage({v:VERSION,kind:KIND,req,request},'*');
 });
}
