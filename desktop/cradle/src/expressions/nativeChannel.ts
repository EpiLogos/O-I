/** Frame-bound, epoch-bound ownership of one real QL material process.
 * Source material stays behind Central; the frame never chooses executables.
 */
import {kernelOp} from '../kernel/bridge';
import {listFiles,readFile} from '../files/client';
import type {KernelTransportStatus,NativeExpressionRequest,NativeSceneRecordingRequest,NativeSelectedSceneRequest} from '../kernel/types';
export const NATIVE_CHANNEL = 'oi.native-expression/v1';
type CarriedOperation='acoustic_scene_edit'|'physical_scene_edit'|'retain_selected_scene_source'|'recover_selected_scene_source'|'procedural_conduct'|'procedural_definition_retry'|'procedural_source_bootstrap_retry';
type CarriedRequest=Extract<NativeExpressionRequest,{operation:CarriedOperation}>&{lease?:string};
type Request=Exclude<NativeExpressionRequest,{operation:CarriedOperation|'procedural_compile'}>|CarriedRequest|{operation:'native-performance-recording';lease:string;request:NativeSceneRecordingRequest};
export type NativeCall = (request:Request) => Promise<any>;
/** The frame-only lease is checked below; native strict DTOs retain their own
 * nested lease and reject extra outer fields. */
function nativeWireRequest(request:Exclude<Request,{operation:'native-performance-recording'}>):NativeExpressionRequest {
  switch(request.operation){
    case 'acoustic_scene_edit':return {operation:request.operation,request:request.request};
    case 'physical_scene_edit':return {operation:request.operation,request:request.request};
    case 'retain_selected_scene_source':case 'recover_selected_scene_source':return {operation:request.operation,request:request.request};
    case 'procedural_source_bootstrap_retry':return {operation:request.operation,request:request.request};
    case 'procedural_conduct':case 'procedural_definition_retry':return {operation:request.operation,request:request.request};
    default:return request;
  }
}

/** Exported for a controlled protocol test; production always uses kernelOp. */
export function relayNativeChannel(frame: HTMLIFrameElement, transport:KernelTransportStatus,
  call:NativeCall = async request => {
    const reply = await kernelOp(transport, request.operation==='native-performance-recording'?{op:'native-performance-recording',request:request.request}:{op:'native_expression',request:nativeWireRequest(request)});
    if (reply.error || reply.outcome?.result !== 'native_expression') throw new Error(reply.error ?? 'native-expression kernel result unavailable');
    return reply.outcome.data;
  }): () => void {
  let live=true, epoch=crypto.randomUUID(), lease:string|null=null, opening=false, surfaceVisible=false;
  let selectedOpening:Extract<NativeExpressionRequest,{operation:'open_selected_scene'}>|null=null;
  const send=(payload:Record<string,unknown>)=>frame.contentWindow?.postMessage({schema:NATIVE_CHANNEL,epoch,...payload},'*');
  const close=(owned:string|null)=>{ if(owned) void call({operation:'close',lease:owned}).catch(()=>{}); };
  const invalidate=()=>{ const owned=lease; lease=null; opening=false; selectedOpening=null; epoch=crypto.randomUUID(); close(owned); };
  const announce=()=>{send({kind:'available',available:transport.kind!=='unavailable',reason:transport.kind==='unavailable'?transport.reason:null});send({kind:'visibility',visible:surfaceVisible});};
  const loaded=()=>{invalidate();announce();};
  const handler=async(event:MessageEvent)=>{
    if(!live || event.source!==frame.contentWindow || event.data?.schema!==NATIVE_CHANNEL)return;
    const data=event.data;
    if(data.kind==='hello'){announce();return;}
    if(data.epoch!==epoch)return;
    if(data.kind==='dispose'){invalidate();return;}
    if(!Number.isSafeInteger(data.req) || data.req<1)return;
    const basis=epoch;
    const respond=(payload:Record<string,unknown>)=>{if(live && basis===epoch)send({kind:'result',req:data.req,...payload});};
    const request=data.request as Request|undefined;
    try {
      if(data.request?.operation==='source'){
        const path=data.request.path;
        if(typeof path!=='string'||!path.trim()||path.length>4096)throw new Error('Central binding path required');
        if(path.startsWith('/'))throw new Error('Binding source requires a relative Central path');
        const slash=path.lastIndexOf('/');const directory=await listFiles(transport,slash>=0?path.slice(0,slash):'');
        const entry=directory.entries.find(e=>e.name===path.slice(slash+1)&&e.retrieval_allowed);
        if(!entry)throw new Error('Central binding source unavailable or withheld');
        const reading=await readFile(transport,entry.location);
        if(reading.byte_len>32*1024*1024)throw new Error('binding source exceeds 32 MiB');
        respond({ok:true,data:{path,location:reading.location,revision:reading.revision,content:reading.content}});return;
      }
      if(!request || !['open','compose','prepare_world','exchange','close','acoustic_scene_edit','physical_scene_edit','native-performance-recording','open_selected_scene','recover_selected_scene','abandon_selected_scene','retain_selected_scene_source','recover_selected_scene_source','procedural_conduct','procedural_definition_retry','procedural_source_bootstrap_retry','source_authorship','procedure_authorship','procedural_stage_capability','procedural_stage_library','procedural_stage_library_retry'].includes(request.operation))throw new Error('unsupported native-expression operation');
      // Preparation returns an admitted owner world without opening a driver.
      // It neither acquires nor releases this frame's existing lease.
      if(request.operation==='source_authorship'||request.operation==='procedure_authorship'||request.operation==='procedural_stage_capability'||request.operation==='procedural_stage_library'||request.operation==='procedural_stage_library_retry'){
        // Pure current-Document authoring intent reads: no lease/open/Source
        // exchange, and no caller-authored graph or native receipt.
        respond({ok:true,data:await call(request)});return;
      }
      if(request.operation==='prepare_world'){
        const result=await call(request);
        if(!result || result.schema!=='oi.native-expression-prepared-world/v1' || result.source?.world?.schema!=='ql.scene-world/v1' || result.source?.sky?.schema!=='ql.sky-snapshot/v1' || result.lease!==undefined)throw new Error('invalid native world preparation receipt');
        respond({ok:true,data:result});return;
      }
      // Compose is an open whose binding QL writes: same lease law. Only the
      // consumer request travels; the kernel validates it strictly.
      if(request.operation==='recover_selected_scene' || request.operation==='abandon_selected_scene'){
        const sameSelected=(a:NativeSelectedSceneRequest,b:NativeSelectedSceneRequest)=>a.expression_ref===b.expression_ref&&a.document_revision===b.document_revision&&a.scene_ref===b.scene_ref&&a.scene_revision===b.scene_revision;
        if(opening || selectedOpening && !sameSelected(selectedOpening.request,request.request) || lease && !selectedOpening)throw new Error('this frame owns another original native opening');
        // On a cold retained intent the native Manager alone looks up the
        // exact original four-ref opening; no old receipt is issued as a new ACK.
        selectedOpening={operation:'open_selected_scene',request:{...request.request}};opening=true;
        const result=await call(request);
        if(request.operation==='recover_selected_scene'){
          if(result?.schema!=='oi.native-expression-selected-scene-recovery/v1')throw new Error('invalid original native opening recovery receipt');
          if(result.recoverable===true){
            const original=result.original_open;
            if(original?.schema!=='oi.native-expression-open/v1'||typeof original.lease!=='string'||!sameSelected(original.selected_scene,request.request)||lease && lease!==original.lease)throw new Error('native recovery returned another original opening');
            if(!live || basis!==epoch){close(original.lease);return;}
            lease=original.lease;
          }
        }else{
          if(result?.schema!=='oi.native-expression-closed/v1'||result.closed!==true||result.abandoned!==true||!sameSelected(result.original_selected_scene,request.request)||typeof result.lease!=='string'||lease && result.lease!==lease)throw new Error('native abandonment did not close this original opening');
          if(basis===epoch){lease=null;selectedOpening=null;}
        }
        respond({ok:true,data:result});return;
      }
      if(request.operation==='open' || request.operation==='compose'||request.operation==='open_selected_scene'){
        if(lease || opening||selectedOpening)throw new Error('this frame already owns or is opening a native driver');
        opening=true;if(request.operation==='open_selected_scene')selectedOpening=request;
        const result=await call(request.operation==='compose'?{operation:'compose',request:request.request}:request);
        if(!result || result.schema!=='oi.native-expression-open/v1' || typeof result.lease!=='string')throw new Error('invalid native open receipt');
        if(!live || basis!==epoch){close(result.lease);return;}
        lease=result.lease;respond({ok:true,data:result});
      }else{
        const carried=request.operation==='acoustic_scene_edit'||request.operation==='physical_scene_edit'||request.operation==='retain_selected_scene_source'||request.operation==='recover_selected_scene_source'||request.operation==='procedural_conduct'||request.operation==='procedural_definition_retry'||request.operation==='procedural_source_bootstrap_retry';
        const frameLease='lease' in request?request.lease:undefined;
        const requestedLease=carried?request.request.lease:frameLease;
        if(!lease || requestedLease!==lease || frameLease!==undefined&&frameLease!==lease)throw new Error('native lease does not belong to this frame epoch');
        if(request.operation==='native-performance-recording'&&request.request.lease!==lease)throw Error('recording lease does not belong to this exact frame epoch');
        const owned=lease;
        const result=await call(request);
        if(request.operation==='close' && basis===epoch && lease===owned)lease=null;
        respond({ok:true,data:result});
      }
    }catch(error){respond({ok:false,error:String(error)});}
    finally{if(basis===epoch&&(request?.operation==='open'||request?.operation==='compose'||request?.operation==='open_selected_scene'||request?.operation==='recover_selected_scene'||request?.operation==='abandon_selected_scene'))opening=false;}
  };
  const visibility=new IntersectionObserver(entries=>{
    surfaceVisible=entries.some(e=>e.isIntersecting && e.intersectionRatio>0);
    if(live)send({kind:'visibility',visible:surfaceVisible});
  });
  visibility.observe(frame);
  window.addEventListener('message',handler);frame.addEventListener('load',loaded);announce();
  return ()=>{live=false;invalidate();visibility.disconnect();window.removeEventListener('message',handler);frame.removeEventListener('load',loaded);};
}
