import {useEffect,useMemo,useRef,useState} from 'react';
import type {GraphReading} from './graph';
import type {Point} from './layout';
import {pointsForReading,topologyKey} from './layoutIdentity';

/** One worker per live graph view. Publication is generation-checked and prior
 * positions remain usable while changed topology is solved. */
export function useLayout(reading:GraphReading|undefined):{points:Point[];error?:string} {
  const worker=useRef<Worker>();
  const generation=useRef(0);
  const pending=useRef<{generation:number;reading:GraphReading}>();
  const [result,setResult]=useState<{positions:Map<string,Point>;error?:string}>(()=>({positions:new Map()}));
  const key=useMemo(()=>reading?topologyKey(reading):undefined,[reading]);
  const latest=useRef(reading);latest.current=reading;
  useEffect(()=>{
    let instance:Worker;
    try {
      instance=new Worker(new URL('./layout.worker.ts',import.meta.url),{type:'module'});
      worker.current=instance;
      instance.onmessage=(event:MessageEvent<{generation:number;points?:Point[];error?:string}>)=>{
        const request=pending.current;
        if(!request||request.generation!==event.data.generation)return;
        const points=event.data.points;
        if(event.data.error||!points||points.length!==request.reading.nodes.length){
          setResult(current=>({...current,error:event.data.error??'Graph layout returned mismatched points'}));return;
        }
        setResult({positions:new Map(request.reading.nodes.map((node,index)=>[node.ref,points[index]])),error:undefined});
      };
      instance.onerror=event=>setResult(current=>({...current,error:event.message||'Graph layout failed'}));
    } catch(error) {setResult(current=>({...current,error:String(error)}));return;}
    return()=>{++generation.current;pending.current=undefined;worker.current=undefined;instance.terminate();};
  },[]);
  useEffect(()=>{
    const current=latest.current;
    if(!current||!worker.current)return;
    const id=++generation.current;
    pending.current={generation:id,reading:current};
    worker.current.postMessage({generation:id,reading:current});
  },[key]);
  return {points:pointsForReading(reading,result.positions),error:result.error};
}
