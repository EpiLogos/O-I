/** Request actual placement from the shell which owns Surface hosting.
 * A native World portal receipt alone is not a placed source surface. */
export function openScenePortal(trigger_ref:string,basis:{expression_ref:string;revision:number;scene_ref:string}):Promise<void>{
 if(window.parent===window)return Promise.reject(Error('Source placement requires the native application host.'));
 const request_id=crypto.randomUUID();
 return new Promise((resolve,reject)=>{
  const finish=(error?:string)=>{clearTimeout(timer);window.removeEventListener('message',receive);window.removeEventListener('pagehide',closed);error?reject(Error(error)):resolve();};
  const receive=(event:MessageEvent)=>{
   if(event.source!==window.parent||event.data?.v!==1||event.data.kind!=='scene-portal-result'||event.data.request_id!==request_id)return;
   finish(event.data.ok===true?undefined:String(event.data.error||'The host did not place the source.'));
  };
  const closed=()=>finish('The Expression frame closed before source placement was acknowledged.');
  const timer=window.setTimeout(()=>finish('Source placement was not acknowledged. Inspect the current host before retrying.'),90000);
  window.addEventListener('message',receive);window.addEventListener('pagehide',closed,{once:true});
  window.parent.postMessage({v:1,kind:'host-request',request:'scene-portal',request_id,
   detail:{trigger_ref,subject:{ref:basis.expression_ref,revision:basis.revision,sceneRef:basis.scene_ref}}},'*');
 });
}
