import {useEffect,useRef} from 'react';
import {listen} from '@tauri-apps/api/event';
import type {SurfaceBinding} from '../surface/types';
import {presentPageObservation} from './PageContext';
type Result={id:string;request:string;result:unknown;url:string};
export function useBrowserContext(binding:SurfaceBinding,native:boolean,mode:string,loading:boolean|undefined,control:(action:string,args?:Record<string,unknown>)=>Promise<unknown>){
 const attach=useRef<()=>void>(()=>{});
 useEffect(()=>{
  if(!native)return;
  let disposed=false,busy=false,unlisten:(()=>void)|undefined,unpick:(()=>void)|undefined,configured=false;
  const requests=new Map<string,{resolve:(value:Result|null)=>void;timer:ReturnType<typeof setTimeout>}>();
  const ready=listen<Result>('oi:browser-context',event=>{if(event.payload.id!==binding.id)return;const request=requests.get(event.payload.request);if(!request)return;clearTimeout(request.timer);requests.delete(event.payload.request);request.resolve(event.payload);}).then(fn=>{if(disposed)fn();else unlisten=fn;});
  const rpc=async(op:string,value?:unknown):Promise<Result|null>=>{await ready;if(disposed)return null;return new Promise(resolve=>{const request=crypto.randomUUID();const timer=setTimeout(()=>{requests.delete(request);resolve(null);},2000);requests.set(request,{resolve,timer});void control('context',{address:JSON.stringify({request,op,value})}).catch(()=>{clearTimeout(timer);requests.delete(request);resolve(null);});});};
  const present=(reading:Result|null)=>{if(!reading||disposed)return;presentPageObservation(binding,reading.result,async key=>{const validation=await rpc('validate',key);return validation?.url===reading.url&&validation.result===true;},reading.url);};
  void listen<Result>('oi:browser-picked',event=>{if(event.payload.id===binding.id&&mode==='components')present(event.payload);}).then(fn=>{if(disposed)fn();else unpick=fn;});
  const tick=async()=>{if(disposed||busy||loading)return;busy=true;try{if(!configured){const response=await rpc('mode',{scope:mode,ink:getComputedStyle(document.body).getPropertyValue('--oi-accent-ink').trim()});configured=response?.result===true;}}finally{busy=false;}};
  attach.current=()=>{if(mode!=='off')void rpc('selection').then(present);};
  const timer=setInterval(()=>void tick(),200);void tick();
  return()=>{disposed=true;clearInterval(timer);unlisten?.();unpick?.();attach.current=()=>{};requests.forEach(request=>{clearTimeout(request.timer);request.resolve(null);});requests.clear();};
 },[binding.id,native,mode,loading]);
 return ()=>attach.current();
}
