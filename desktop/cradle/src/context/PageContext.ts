import {useEffect,type RefObject} from 'react';
import type {SurfaceBinding} from '../surface/types';
import {registerPageObservation} from './ComponentSelection';
export interface PageObservation {key:string;documentId:string;text:string;error?:string;selector:string;role:string;nodeRef?:string;sourceStart?:number;sourceEnd?:number;bounds:{x:number;y:number;width:number;height:number};pageUrl?:string}
export function presentPageObservation(binding:SurfaceBinding,value:unknown,validate:(key:string,documentId:string)=>Promise<boolean>,sourceRef?:string,mark?:(key:string,documentId:string,enabled:boolean)=>void,revision?:string){
 const observation=value as PageObservation;
 if(!observation||typeof observation.key!=="string"||typeof observation.documentId!=="string"||typeof observation.text!=="string"||observation.text.length>65536||typeof observation.selector!=="string"||observation.selector.length>4096||!observation.bounds||!['x','y','width','height'].every(key=>typeof (observation.bounds as Record<string,unknown>)[key]==='number'&&Number.isFinite((observation.bounds as Record<string,number>)[key])))return;
 if(observation.error){window.dispatchEvent(new CustomEvent('oi:context-candidate',{detail:{bindingId:binding.id,kind:'element',text:'',error:observation.error}}));return;}
 if(!observation.text.trim())return;
 const observationKey=registerPageObservation(observation.text,()=>validate(observation.key,observation.documentId),enabled=>mark?.(observation.key,observation.documentId,enabled));
 const exact=revision&&Number.isSafeInteger(observation.sourceStart)&&Number.isSafeInteger(observation.sourceEnd)&&observation.sourceEnd! - observation.sourceStart! ===observation.text.length;
 window.dispatchEvent(new CustomEvent('oi:context-candidate',{detail:{bindingId:binding.id,kind:exact?'text':'element',text:observation.text,selector:observation.selector,role:observation.role,nodeRef:observation.nodeRef,bounds:observation.bounds,observationKey,documentId:observation.documentId,sourceRef:sourceRef??binding.ref,pageUrl:observation.pageUrl,start:exact?observation.sourceStart:undefined,end:exact?observation.sourceEnd:undefined,revision}}));
}
export function useMaterialContext(container:RefObject<HTMLDivElement>,binding:SurfaceBinding,lifecycleKey:string){
 useEffect(()=>{
  const root=container.current?.closest<HTMLElement>('.editor-frame');if(!root)return;
  let disposed=false,busy=false,lastFrame:HTMLIFrameElement|null=null,lastMode='';
  const requests=new Map<string,{frame:HTMLIFrameElement;resolve:(value:unknown)=>void;timer:ReturnType<typeof setTimeout>}>();
  const receive=(event:MessageEvent)=>{if(event.data?.type!=='oi:page-context-response')return;const request=requests.get(event.data.request);if(!request||event.source!==request.frame.contentWindow)return;clearTimeout(request.timer);requests.delete(event.data.request);request.resolve(event.data.result);};
  window.addEventListener('message',receive);
  const rpc=(frame:HTMLIFrameElement,op:string,value?:unknown)=>new Promise<unknown>(resolve=>{if(disposed||!frame.isConnected){resolve(null);return;}const request=crypto.randomUUID();const timer=setTimeout(()=>{requests.delete(request);resolve(null);},1500);requests.set(request,{frame,resolve,timer});frame.contentWindow?.postMessage({type:'oi:page-context-request',request,op,value},'*');});
  const mode=()=>root.dataset.editorMode==='context'?root.dataset.contextScope??'text':'off';
  const present=(frame:HTMLIFrameElement,value:unknown)=>{if(!disposed)presentPageObservation(binding,value,async (key,documentId)=>!!await rpc(frame,'validate',{key,documentId}),undefined,(key,documentId,enabled)=>{void rpc(frame,'mark',{key,documentId,enabled});},frame.dataset.fileRevision);};
  const tick=async()=>{if(disposed||busy)return;const frame=root.querySelector<HTMLIFrameElement>('iframe[data-page-context]');if(!frame)return;
   // Presentation gate (workspace-continuity WF5): a concealed surface — a
   // parked retention host, a display:none pane, a hidden window — is not
   // polled. Owner activity is untouched; the observation resumes from the
   // document's own state on reveal.
   if(typeof root.checkVisibility==='function'?!root.checkVisibility():root.offsetParent===null)return;
   busy=true;try{const scope=mode();if(frame!==lastFrame||scope!==lastMode){const accepted=await rpc(frame,'mode',{scope,ink:getComputedStyle(document.body).getPropertyValue('--oi-accent-ink').trim()});if(!accepted)return;lastFrame=frame;lastMode=scope;}present(frame,await rpc(frame,'take'));}finally{busy=false;}};
  const attach=()=>{const frame=root.querySelector<HTMLIFrameElement>('iframe[data-page-context]');if(frame)void rpc(frame,'selection').then(value=>present(frame,value));};
  const loaded=()=>{lastFrame=null;void tick();};
  root.addEventListener('load',loaded,true);root.addEventListener('oi:page-attach-selection',attach);
  const timer=setInterval(()=>void tick(),180);void tick();
  return()=>{disposed=true;clearInterval(timer);window.removeEventListener('message',receive);root.removeEventListener('load',loaded,true);root.removeEventListener('oi:page-attach-selection',attach);requests.forEach(request=>{clearTimeout(request.timer);request.resolve(null);});requests.clear();};
 },[container,binding.id,lifecycleKey]);
}
