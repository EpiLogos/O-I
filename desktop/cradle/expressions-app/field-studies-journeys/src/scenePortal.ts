import {fromHost,postToHost} from './hostChannel';
/** Request actual placement from the shell which owns Surface hosting.
 * A native World portal receipt alone is not a placed source surface. It resolves with the shell's words of what the trigger's placement
 * could not honour as asked (O-I #747 round 895, OPEN 4), or with nothing. */
export function openScenePortal(trigger_ref:string,basis:{expression_ref:string;revision:number;scene_ref:string}):Promise<string|undefined>{
 if(window.parent===window)return Promise.reject(Error('Source placement requires the native application host.'));
 const request_id=crypto.randomUUID();
 return new Promise((resolve,reject)=>{
  const finish=(error?:string,note?:string)=>{clearTimeout(timer);window.removeEventListener('message',receive);window.removeEventListener('pagehide',closed);error?reject(Error(error)):resolve(note);};
  const receive=(event:MessageEvent)=>{
   if(!fromHost(event)||event.data?.v!==1||event.data.kind!=='scene-portal-result'||event.data.request_id!==request_id)return;
   if(event.data.ok===true)finish(undefined,typeof event.data.note==='string'?event.data.note:undefined);else finish(String(event.data.error||'The host did not place the source.'));
  };
  const closed=()=>finish('The Expression frame closed before source placement was acknowledged.');
  const timer=window.setTimeout(()=>finish('Source placement was not acknowledged. Inspect the current host before retrying.'),90000);
  window.addEventListener('message',receive);window.addEventListener('pagehide',closed,{once:true});
  postToHost({v:1,kind:'host-request',request:'scene-portal',request_id,
   detail:{trigger_ref,subject:{ref:basis.expression_ref,revision:basis.revision,sceneRef:basis.scene_ref}}});
 });
}
