/** Live frame ports, not a person/scene registry. Only an explicit local act
 * can send a minimal private presentation into one chosen, ready app frame. */
import {IDENTITY_CHANNEL,validateIdentityPattern,type PrivateIdentityPattern} from '../identityPresentation';
interface Host {id:string;label:string;send(pattern:PrivateIdentityPattern):Promise<void>;end():Promise<void>}
const hosts=new Map<string,Host>(),listeners=new Set<()=>void>();
const changed=()=>{for(const listener of listeners)listener();};
export const identityHosts=()=>[...hosts.values()].map(h=>({id:h.id,label:h.label}));
export function subscribeIdentityHosts(listener:()=>void):()=>void{listeners.add(listener);return()=>{listeners.delete(listener);};}
export async function presentIdentity(hostId:string,pattern:PrivateIdentityPattern):Promise<void>{const host=hosts.get(hostId);if(!host)throw new Error('That Expressions window is no longer ready');await host.send(validateIdentityPattern(pattern));}
export async function endIdentity(hostId:string):Promise<void>{await hosts.get(hostId)?.end();}
/** Added only to the existing trusted application host. A reload removes the
 * port and pending requests; private state is never replayed into a new page. */
export function relayPrivateIdentity(frame:HTMLIFrameElement):()=>void{
  const id=crypto.randomUUID(),url=frame.src,origin=new URL(url,window.location.href).origin;
  const destination=origin==='null'?'*':origin;
  let live=true,epoch='';
  const awaiting=new Map<string,{resolve:()=>void;reject:(reason:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  function clear(){hosts.delete(id);epoch='';for(const wait of awaiting.values()){clearTimeout(wait.timer);wait.reject(new Error('Expressions presentation was replaced; no private state was replayed'));}awaiting.clear();changed();}
  function announce(){clear();if(live&&frame.src===url)frame.contentWindow?.postMessage({schema:IDENTITY_CHANNEL,operation:'probe'},destination);}
  async function send(operation:'present'|'end',pattern?:PrivateIdentityPattern):Promise<void>{
    if(!live||!epoch||frame.src!==url)throw new Error('The selected Expressions page changed');
    const request_id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{awaiting.delete(request_id);reject(new Error('Private presentation acknowledgement was lost; close the view before continuing'));},5000);awaiting.set(request_id,{resolve,reject,timer});frame.contentWindow?.postMessage({schema:IDENTITY_CHANNEL,operation,epoch,request_id,...(pattern?{pattern}:{})},destination);});
  }
  const receive=(event:MessageEvent)=>{
    if(!live||frame.src!==url||event.source!==frame.contentWindow||event.origin!==origin)return;
    const message=event.data;if(!message||message.schema!==IDENTITY_CHANNEL)return;
    if(message.operation==='ready'&&typeof message.epoch==='string'&&message.epoch.length<128){
      if(epoch&&epoch!==message.epoch)clear();const first=!epoch;epoch=message.epoch;if(first)frame.contentWindow?.postMessage({schema:IDENTITY_CHANNEL,operation:'probe'},destination);
      hosts.set(id,{id,label:frame.title||'Expressions',send:async pattern=>{await send('present',pattern);},end:async()=>{await send('end');}});changed();return;
    }
    if(message.epoch!==epoch)return;
    if(message.operation==='ended'){changed();return;}
    const pending=awaiting.get(message.request_id);if(!pending)return;
    awaiting.delete(message.request_id);clearTimeout(pending.timer);
    if(message.ok===true)pending.resolve();else pending.reject(new Error(typeof message.reason==='string'?message.reason:'The Expressions app refused the private presentation'));
  };
  frame.addEventListener('load',announce);window.addEventListener('message',receive);announce();
  return()=>{if(epoch&&frame.src===url)frame.contentWindow?.postMessage({schema:IDENTITY_CHANNEL,operation:'end',epoch,request_id:crypto.randomUUID()},destination);live=false;frame.removeEventListener('load',announce);window.removeEventListener('message',receive);clear();};
}
