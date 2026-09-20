const SCHEMA='oi.native-expression/v1';
export interface NativePort {request(request:unknown):Promise<any>;dispose():void;readonly available:boolean;onHold?:(reason:string)=>void}
/** A fresh epoch is required after reload; stale completions cannot bind a new app. */
export class NativeChannel implements NativePort {
 private epoch:string|null=null; private seq=0; private dead=false; available=false;
 onHold?:(reason:string)=>void;
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:number}>();
 constructor(){window.addEventListener('message',this.message);window.parent.postMessage({schema:SCHEMA,kind:'hello'},'*');}
 private rejectAll(reason:string){for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error(reason));}this.pending.clear();}
 private message=(event:MessageEvent)=>{
  if(this.dead || event.source!==window.parent || event.data?.schema!==SCHEMA)return;
  const data=event.data;
  if(data.kind==='available' && typeof data.epoch==='string'){
   if(this.epoch && data.epoch!==this.epoch){this.rejectAll('host epoch changed; native continuation unavailable');this.onHold?.('host epoch changed');}
   this.epoch=data.epoch;this.available=data.available===true;return;
  }
  if(data.epoch!==this.epoch)return;
  if(data.kind==='visibility' && data.visible===false){this.onHold?.('host surface hidden');return;}
  if(data.kind!=='result')return;
  const pending=this.pending.get(data.req);if(!pending)return;
  this.pending.delete(data.req);clearTimeout(pending.timer);
  if(data.ok===true)pending.resolve(data.data);else pending.reject(new Error(typeof data.error==='string'?data.error:'native operation refused'));
 };
 request(request:unknown):Promise<any>{
  if(this.dead || !this.epoch || !this.available)return Promise.reject(new Error('Native QL host channel unavailable. Ordinary Expressions remains usable.'));
  const req=++this.seq;
  return new Promise((resolve,reject)=>{
   const timer=window.setTimeout(()=>{this.pending.delete(req);this.onHold?.('native acknowledgement unknown; not retried');reject(new Error('native acknowledgement timed out; not retried'));},15000);
   this.pending.set(req,{resolve,reject,timer});window.parent.postMessage({schema:SCHEMA,epoch:this.epoch,req,kind:'request',request},'*');
  });
 }
 dispose(){if(this.dead)return;if(this.epoch)window.parent.postMessage({schema:SCHEMA,epoch:this.epoch,kind:'dispose'},'*');this.dead=true;this.available=false;this.rejectAll('native channel disposed');window.removeEventListener('message',this.message);}
}
