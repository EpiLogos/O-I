import {useEffect,useRef,useSyncExternalStore,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {admitCandidate,preparedAdd,preparedClear,preparedRemove,preparedSnapshot,preparedSubscribe,type ContextCandidateDetail,type PreparedItem} from "./prepared";
import {setObservationCue} from "./ComponentSelection";
import "./context.css";

/**
 * The selection → context seam without the modal (owner direction
 * 2026-09-19). Mounted once beside the frame; it listens for the existing
 * `oi:context-candidate` dispatch (editor attach gesture, ⌘⇧2, context
 * menu, component picking, page/browser observations, terminal attach),
 * validates currency through the same owner reads the tray used, and
 * stages a prepared item. A subtle cue marks the source; nothing expands,
 * nothing steals focus. Delivery happens later, per item, in the right
 * region's Context plane.
 */
export function PreparedContext({bindings}:{bindings:Record<string,SurfaceBinding>}){
 const kernel=useKernel();
 // The frame hands the merged per-workspace binding record; the listener
 // reads the current one at event time (the tray's own latest-ref pattern).
 const latest=useRef({bindings,kernel});latest.current={bindings,kernel};
 const [notice,setNotice]=useState<{text:string;bad:boolean}|undefined>();
 useEffect(()=>{
  let generation=0;
  const take=(event:Event)=>{
   const candidate=(event as CustomEvent<ContextCandidateDetail>).detail;
   if(!candidate)return;
   const current=++generation;
   const {bindings:currentBindings,kernel:currentKernel}=latest.current;
   admitCandidate({transport:currentKernel.transport,buffers:currentKernel.snapshot.buffers,bindings:currentBindings},{...candidate}).then(item=>{
    if(current!==generation)return;
    preparedAdd(item);
    setNotice({text:`Added to context · ${item.title}`,bad:false});
   }).catch(reason=>{
    if(current!==generation)return;
    setNotice({text:String(reason),bad:true});
   });
  };
  window.addEventListener("oi:context-candidate",take);
  return()=>{generation++;window.removeEventListener("oi:context-candidate",take);};
 },[]);
 // Source cues follow the store: element observations toggle a class on
 // their held node; editors subscribe to the store themselves and redraw
 // their CodeMirror cue decorations from the same items.
 useEffect(()=>{
  const sync=(previous:readonly PreparedItem[],next:readonly PreparedItem[])=>{
   const removed=previous.filter(item=>!next.some(other=>other.id===item.id));
   for(const item of removed)if(item.observationKey)setObservationCue(item.observationKey,false);
   for(const item of next)if(item.kind==="element"&&item.observationKey)setObservationCue(item.observationKey,true);
  };
  let previous=preparedSnapshot();
  const unsubscribe=preparedSubscribe(()=>{
   const next=preparedSnapshot();
   sync(previous,next);
   previous=next;
  });
  return()=>{unsubscribe();for(const item of previous)if(item.observationKey)setObservationCue(item.observationKey,false);};
 },[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(undefined),5200);return()=>clearTimeout(timer);},[notice]);
 // A quiet corner status: staging feedback without a dialog, without focus.
 return notice?<div className="prepared-notice" data-prepared-notice={notice.bad?"refused":"added"} role="status">{notice.text}</div>:null;
}

/** Live read of the staging store (count badge, Context plane list). */
export function usePreparedItems():readonly PreparedItem[]{
 return useSyncExternalStore(preparedSubscribe,preparedSnapshot,preparedSnapshot);
}

/** The transient selection preview: what the person is holding right now,
 * before any decision about it. Editors already broadcast their selection;
 * this keeps only a bounded display line and never stages anything. */
export function useTransientSelection():{text:string;sourceRef?:string}|undefined{
 const [preview,setPreview]=useState<{text:string;sourceRef?:string}|undefined>();
 useEffect(()=>{
  const read=(event:Event)=>{
   const detail=(event as CustomEvent<{selected:boolean;text?:string;sourceRef?:string}>).detail;
   if(!detail)return;
   setPreview(detail.selected&&detail.text?{text:detail.text.slice(0,400),sourceRef:detail.sourceRef}:undefined);
  };
  window.addEventListener("oi:editor-selection",read);
  return()=>window.removeEventListener("oi:editor-selection",read);
 },[]);
 return preview;
}

export {preparedClear,preparedRemove,preparedSnapshot};
