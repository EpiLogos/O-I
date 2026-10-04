const SCHEMA='oi.native-expression/v1';
export interface NativeStageCompilationDelivery {readonly raw:unknown;readonly completion:unknown}
export interface NativePort {request(request:unknown):Promise<any>;requestStageCompilation?:(request:unknown)=>Promise<NativeStageCompilationDelivery>;consumeStageCompilationCompletion?:(completion:unknown,expectedRequest:unknown)=>unknown;requestNativeDefinition?:(request:unknown)=>Promise<NativeStageCompilationDelivery>;consumeNativeDefinitionCompletion?:(completion:unknown,expectedRequest:unknown)=>unknown;dispose():void;readonly available:boolean;onHold?:(reason:string)=>void}
// This WeakMap owns only one-use callback custody from an actual channel
// message. Its token cannot be constructed/imported from caller JSON and
// supplies no FIELD receipt, native owner, Source grant or application state.
const stageCompletions=new WeakMap<object,{channel:NativeChannel;epoch:string;request:unknown;raw:unknown}>();
function sameRequest(a:unknown,b:unknown):boolean {
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameRequest(v,b[i]));
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameRequest((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
}
/** A fresh epoch is required after reload; stale completions cannot bind a new app. */
export class NativeChannel implements NativePort {
 private epoch:string|null=null; private seq=0; private dead=false; available=false;
 private stageCompletion:object|null=null;
 onHold?:(reason:string)=>void;
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:number;stageRequest?:unknown}>();
 constructor(){window.addEventListener('message',this.message);window.parent.postMessage({schema:SCHEMA,kind:'hello'},'*');}
 private forgetStageCompletion(){if(this.stageCompletion)stageCompletions.delete(this.stageCompletion);this.stageCompletion=null;}
 private rejectAll(reason:string){this.forgetStageCompletion();for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error(reason));}this.pending.clear();}
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
  if(data.ok===true){
   if(pending.stageRequest!==undefined){
    // Script-dispatched message labels cannot mint an actual host completion.
    if(event.isTrusted!==true||!this.epoch){pending.reject(new Error('Stage callback lacks an actual trusted native host message'));return;}
    try{
     // Charge this one retained request/outcome before making its private copy.
     // A new actual Stage invocation invalidates any previous unconsumed token.
     const rawBytes=JSON.stringify(data.data),requestBytes=JSON.stringify(pending.stageRequest);
     if(typeof rawBytes!=='string'||(rawBytes.length+requestBytes.length)*2>8*1024*1024)throw Error('Native Stage callback custody exceeds its 8MiB ceiling');
     this.forgetStageCompletion();const completion=Object.freeze(Object.create(null));
     stageCompletions.set(completion,{channel:this,epoch:this.epoch,request:pending.stageRequest,raw:structuredClone(data.data)});this.stageCompletion=completion;
     pending.resolve({raw:data.data,completion});
    }catch(error){pending.reject(error instanceof Error?error:new Error(String(error)));}
   }else pending.resolve(data.data);
  }else pending.reject(new Error(typeof data.error==='string'?data.error:'native operation refused'));
 };
 request(request:unknown):Promise<any>{return this.send(request);}
 requestStageCompilation(request:unknown):Promise<NativeStageCompilationDelivery>{
  if(!request||typeof request!=='object'||Object.keys(request).sort().join(',')!=='operation,request'||!['procedural_stage_library','procedural_stage_library_retry'].includes(String((request as {operation?:unknown}).operation)))return Promise.reject(new Error('Stage completion requires its actual original native operation'));
  const intent=(request as {request?:unknown}).request;
  if(!intent||typeof intent!=='object'||Array.isArray(intent)||Object.keys(intent).sort().join(',')!=='action,authored,basis,choice,operation_ref,profile,scope,source')return Promise.reject(new Error('Stage completion requires its complete original eight-field intent'));
  const encoded=JSON.stringify(request);if(encoded.length*2>8*1024*1024)return Promise.reject(new Error('Native Stage original request exceeds its 8MiB custody ceiling'));
  if([...this.pending.values()].some(row=>row.stageRequest!==undefined))return Promise.reject(new Error('The original Stage callback is still pending in this channel; no concurrent lookup or compilation was dispatched'));
  this.forgetStageCompletion();return this.send(structuredClone(request),true);
 }
 requestNativeDefinition(request:unknown):Promise<NativeStageCompilationDelivery>{
  if(!request||typeof request!=='object'||Object.keys(request).sort().join(',')!=='operation,request'||!['procedural_conduct','procedural_definition_retry'].includes(String((request as {operation?:unknown}).operation)))return Promise.reject(new Error('Definition completion requires its actual original native operation'));
  const original=(request as {request?:unknown}).request;
  if(!original||typeof original!=='object'||Array.isArray(original))return Promise.reject(new Error('Definition completion requires the original sealed native request'));
  const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const u64=(value:unknown):value is string=>typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)&&BigInt(value)<=18446744073709551615n;
  const row=original as Record<string,unknown>,host=row.request;
  if(!object(host)||!object(host.command)||!object(host.command.request))return Promise.reject(new Error('Definition completion requires the complete original Host request'));
  const action=host.command.request,keys=Object.keys(original).sort().join(',');
  if(!['document_revision,expression_ref,lease,request','document_revision,expression_ref,lease,request,source_producer_ref'].includes(keys)||typeof row.lease!=='string'||!row.lease.trim()||typeof row.expression_ref!=='string'||!row.expression_ref.trim()||typeof row.document_revision!=='number'||!Number.isSafeInteger(row.document_revision)||row.document_revision<1||
   Object.keys(host).sort().join(',')!=='command,event_ref,expected_generation,expected_samples_elapsed,instance_ref,request_id,schema,subject_ref'||host.schema!=='ql.field-host-request/v1'||!['instance_ref','event_ref','subject_ref'].every(key=>typeof host[key]==='string'&&String(host[key]).trim())||![host.request_id,host.expected_generation,host.expected_samples_elapsed].every(u64)||host.request_id==='0'||Object.keys(host.command).sort().join(',')!=='operation,request'||host.command.operation!=='procedure'||
   !(action.action==='install_prepared'&&Object.keys(action).join(',')==='action'&&typeof row.source_producer_ref==='string'&&/^procedure-source:[a-f0-9]{64}$/.test(row.source_producer_ref)||action.action==='source_continue'&&Object.keys(action).sort().join(',')==='action,procedure_ref'&&typeof action.procedure_ref==='string'&&action.procedure_ref.trim()&&!Object.hasOwn(row,'source_producer_ref')))return Promise.reject(new Error('Definition completion accepts only the native first producer/original Procedure action and exact sealed header'));
  const encoded=JSON.stringify(request);if(encoded.length*2>8*1024*1024)return Promise.reject(new Error('Native definition original request exceeds its 8MiB custody ceiling'));
  if([...this.pending.values()].some(row=>row.stageRequest!==undefined))return Promise.reject(new Error('The original authenticated callback is still pending; no concurrent definition dispatch/lookup was issued'));
  this.forgetStageCompletion();return this.send(structuredClone(request),true);
 }
 consumeNativeDefinitionCompletion(completion:unknown,expectedRequest:unknown):unknown {
  // The SAME authenticated invocation/token store owns both internal callbacks.
  // No second native request or caller-imported ACK is introduced here.
  return this.consumeStageCompilationCompletion(completion,expectedRequest);
 }
 consumeStageCompilationCompletion(completion:unknown,expectedRequest:unknown):unknown {
  if(!completion||typeof completion!=='object')throw new Error('Native Stage callback completion was not issued by this channel');
  const held=stageCompletions.get(completion);
  // Every attempted consumption uses the actual token only once, including
  // wrong-request/expired admission. A bad caller cannot repair and replay it.
  stageCompletions.delete(completion);if(this.stageCompletion===completion)this.stageCompletion=null;
  if(!held||held.channel!==this||this.dead||!this.available||!this.epoch||held.epoch!==this.epoch||!sameRequest(held.request,expectedRequest))throw new Error('Native Stage completion is foreign, expired, consumed or differs from its full original request');
  return held.raw;
 }
 private send(request:unknown,stageCompletion=false):Promise<any>{
  if(this.dead || !this.epoch || !this.available)return Promise.reject(new Error('Native QL host channel unavailable. Ordinary Expressions remains usable.'));
  const req=++this.seq;
  // Construction may resolve one dated sky (120s), compile the owner world
  // (120s), resolve its executable (10s) and open the field (20s). A realtime
  // exchange deadline must not discard that lawful acknowledgement. Unknown
  // acknowledgements still never trigger an automatic retry.
  const operation=request&&typeof request==='object'&&'operation' in request?request.operation:null;
  const timeout=operation==='prepare_world'||operation==='compose'?300000:15000;
  return new Promise((resolve,reject)=>{
   const timer=window.setTimeout(()=>{this.pending.delete(req);if(!stageCompletion)this.onHold?.('native acknowledgement unknown; not retried');reject(new Error('native acknowledgement timed out; not retried'));},timeout);
   this.pending.set(req,{resolve,reject,timer,...(stageCompletion?{stageRequest:request}:{})});window.parent.postMessage({schema:SCHEMA,epoch:this.epoch,req,kind:'request',request},'*');
  });
 }
 dispose(){if(this.dead)return;if(this.epoch)window.parent.postMessage({schema:SCHEMA,epoch:this.epoch,kind:'dispose'},'*');this.dead=true;this.available=false;this.rejectAll('native channel disposed');window.removeEventListener('message',this.message);}
}
