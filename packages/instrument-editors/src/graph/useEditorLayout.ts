import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {GraphReading} from '../../../../desktop/cradle/src/knowledge/graph';
import type {Point} from '../../../../desktop/cradle/src/knowledge/layout';
import {pointsForReading,topologyKey} from '../../../../desktop/cradle/src/knowledge/layoutIdentity';
type Reply={kind:'points';generation:number;points:Point[]}|{kind:'error';generation:number;error:string};
/** Adopted from knowledge/useLayout.ts. The only added ownership is sleeping
 * that same native layout worker while this retained editor is folded. */
export function useEditorLayout(reading:GraphReading|undefined,visible:boolean){
 const worker=useRef<Worker>();const generation=useRef(0);
 const pending=useRef<{generation:number;reading:GraphReading}>();
 const [result,setResult]=useState<{positions:Map<string,Point>;error?:string}>(()=>({positions:new Map()}));
 const key=useMemo(()=>reading?topologyKey(reading):undefined,[reading]);
 const latest=useRef(reading);latest.current=reading;const shown=useRef(visible);shown.current=visible;
 useEffect(()=>{
  let instance:Worker;
  try{instance=new Worker(new URL('../../../../desktop/cradle/src/knowledge/layout.worker.ts',import.meta.url),{type:'module'});worker.current=instance;
   instance.onmessage=(event:MessageEvent<Reply>)=>{const request=pending.current;if(!request||request.generation!==event.data.generation)return;
    if(event.data.kind==='error'){const error=event.data.error;setResult(current=>({...current,error}));return;}
    const points=event.data.points;if(points.length!==request.reading.nodes.length){setResult(current=>({...current,error:'Graph layout returned mismatched native subjects'}));return;}
    setResult({positions:new Map(request.reading.nodes.map((node,index)=>[node.ref,points[index]]))});};
   instance.onerror=event=>setResult(current=>({...current,error:event.message||'Graph layout failed'}));
  }catch(error){setResult(current=>({...current,error:String(error)}));return;}
  const visibility=()=>instance.postMessage({kind:document.hidden||!shown.current?'sleep':'wake'});
  visibility();document.addEventListener('visibilitychange',visibility);
  return()=>{++generation.current;pending.current=undefined;worker.current=undefined;document.removeEventListener('visibilitychange',visibility);instance.terminate();};
 },[]);
 useEffect(()=>{worker.current?.postMessage({kind:document.hidden||!visible?'sleep':'wake'});},[visible]);
 useEffect(()=>{const current=latest.current;if(!current||!worker.current)return;const id=++generation.current;pending.current={generation:id,reading:current};worker.current.postMessage({kind:'layout',generation:id,reading:current});worker.current.postMessage({kind:document.hidden||!shown.current?'sleep':'wake'});},[key]);
 const dragNode=useCallback((ref:string,x:number,y:number)=>{if(shown.current)worker.current?.postMessage({kind:'drag',ref,x,y});},[]);
 const releaseNode=useCallback((ref?:string)=>worker.current?.postMessage({kind:'release',ref}),[]);
 return {points:pointsForReading(reading,result.positions),error:result.error,dragNode,releaseNode};
}
