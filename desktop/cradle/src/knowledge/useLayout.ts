import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {GraphReading} from './graph';
import type {Point} from './layout';
import {pointsForReading,topologyKey} from './layoutIdentity';

type LayoutReply={kind:'points';generation:number;points:Point[]}|{kind:'error';generation:number;error:string};

/** One worker per live graph view. Publication is generation-checked; the
 * worker streams the settling simulation, so prior positions remain usable
 * while changed topology is solved, and a hidden document sleeps the timer. */
export function useLayout(reading:GraphReading|undefined):{points:Point[];error?:string;dragNode:(ref:string,x:number,y:number)=>void;releaseNode:(ref?:string)=>void} {
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
      instance.onmessage=(event:MessageEvent<LayoutReply>)=>{
        if(event.data.kind==='error'){const failure=event.data.error;setResult(current=>({...current,error:failure}));return;}
        const request=pending.current;
        if(!request||request.generation!==event.data.generation)return;
        const points=event.data.points;
        if(!points||points.length!==request.reading.nodes.length){
          setResult(current=>({...current,error:'Graph layout returned mismatched points'}));return;
        }
        setResult({positions:new Map(request.reading.nodes.map((node,index)=>[node.ref,points[index]])),error:undefined});
      };
      instance.onerror=event=>setResult(current=>({...current,error:event.message||'Graph layout failed'}));
    } catch(error) {setResult(current=>({...current,error:String(error)}));return;}
    const visibility=()=>{instance.postMessage({kind:document.hidden?'sleep':'wake'});};
    document.addEventListener('visibilitychange',visibility);
    return()=>{++generation.current;pending.current=undefined;worker.current=undefined;document.removeEventListener('visibilitychange',visibility);instance.terminate();};
  },[]);
  useEffect(()=>{
    const current=latest.current;
    if(!current||!worker.current)return;
    const id=++generation.current;
    pending.current={generation:id,reading:current};
    worker.current.postMessage({kind:'layout',generation:id,reading:current});
  },[key]);
  const dragNode=useCallback((ref:string,x:number,y:number)=>{worker.current?.postMessage({kind:'drag',ref,x,y});},[]);
  const releaseNode=useCallback((ref?:string)=>{worker.current?.postMessage({kind:'release',ref});},[]);
  return {points:pointsForReading(reading,result.positions),error:result.error,dragNode,releaseNode};
}
