import {useEffect,useState} from 'react';
import type {GraphReading} from './graph';
import type {Point} from './layout';
const empty:Point[]=[];
/** Cancel obsolete layout work; the UI never runs the spatial solver. */
export function useLayout(reading:GraphReading|undefined):{points:Point[];error?:string} {
  const [result,setResult]=useState<{reading:GraphReading;points:Point[];error?:string}>();
  useEffect(()=>{if(!reading)return;let worker:Worker;try{worker=new Worker(new URL('./layout.worker.ts',import.meta.url),{type:'module'});worker.onmessage=(event:MessageEvent<{points?:Point[];error?:string}>)=>{setResult({reading,points:event.data.points??[],error:event.data.error});worker.terminate();};worker.onerror=event=>{setResult({reading,points:[],error:event.message||'Graph layout failed'});worker.terminate();};worker.postMessage(reading);}catch(error){setResult({reading,points:[],error:String(error)});return;}return()=>worker.terminate();},[reading]);
  return result&&result.reading===reading?result:{points:empty};
}
