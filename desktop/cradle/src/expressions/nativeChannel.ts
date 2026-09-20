/** Frame-bound, epoch-bound ownership of one real QL material process.
 * Source material stays behind Central; the frame never chooses executables.
 */
import {kernelOp} from '../kernel/bridge';
import {listFiles,readFile} from '../files/client';
import type {KernelTransportStatus} from '../kernel/types';
export const NATIVE_CHANNEL = 'oi.native-expression/v1';
type Request = {operation:'open';path:string;expected_revision:string} |
  {operation:'exchange';lease:string;request:unknown} | {operation:'close';lease:string};
export type NativeCall = (request:Request) => Promise<any>;

/** Exported for a controlled protocol test; production always uses kernelOp. */
export function relayNativeChannel(frame: HTMLIFrameElement, transport:KernelTransportStatus,
  call:NativeCall = async request => {
    const reply = await kernelOp(transport, {op:'native_expression', request});
    if (reply.error || reply.outcome?.result !== 'native_expression') throw new Error(reply.error ?? 'native-expression kernel result unavailable');
    return reply.outcome.data;
  }): () => void {
  let live=true, epoch=crypto.randomUUID(), lease:string|null=null, opening=false;
  const send=(payload:Record<string,unknown>)=>frame.contentWindow?.postMessage({schema:NATIVE_CHANNEL,epoch,...payload},'*');
  const close=(owned:string|null)=>{ if(owned) void call({operation:'close',lease:owned}).catch(()=>{}); };
  const invalidate=()=>{ const owned=lease; lease=null; opening=false; epoch=crypto.randomUUID(); close(owned); };
  const announce=()=>send({kind:'available',available:transport.kind!=='unavailable',reason:transport.kind==='unavailable'?transport.reason:null});
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
        const slash=path.lastIndexOf('/');const directory=await listFiles(transport,slash>0?path.slice(0,slash):'.');
        const entry=directory.entries.find(e=>e.name===path.slice(slash+1)&&e.retrieval_allowed);
        if(!entry)throw new Error('Central binding source unavailable or withheld');
        const reading=await readFile(transport,entry.location);
        if(reading.byte_len>32*1024*1024)throw new Error('binding source exceeds 32 MiB');
        respond({ok:true,data:{path,location:reading.location,revision:reading.revision,content:reading.content}});return;
      }
      if(!request || !['open','exchange','close'].includes(request.operation))throw new Error('unsupported native-expression operation');
      if(request.operation==='open'){
        if(lease || opening)throw new Error('this frame already owns or is opening a native driver');
        opening=true;
        const result=await call(request);
        if(!result || result.schema!=='oi.native-expression-open/v1' || typeof result.lease!=='string')throw new Error('invalid native open receipt');
        if(!live || basis!==epoch){close(result.lease);return;}
        lease=result.lease;respond({ok:true,data:result});
      }else{
        if(!lease || request.lease!==lease)throw new Error('native lease does not belong to this frame epoch');
        const owned=lease;
        const result=await call(request);
        if(request.operation==='close' && basis===epoch && lease===owned)lease=null;
        respond({ok:true,data:result});
      }
    }catch(error){respond({ok:false,error:String(error)});}
    finally{if(basis===epoch)opening=false;}
  };
  const visibility=new IntersectionObserver(entries=>{
    if(live)send({kind:'visibility',visible:entries.some(e=>e.isIntersecting && e.intersectionRatio>0)});
  });
  visibility.observe(frame);
  window.addEventListener('message',handler);frame.addEventListener('load',loaded);announce();
  return ()=>{live=false;invalidate();visibility.disconnect();window.removeEventListener('message',handler);frame.removeEventListener('load',loaded);};
}
