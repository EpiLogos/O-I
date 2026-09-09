import {useEffect,useState,useRef,useCallback} from "react";
export interface DetailRect {x:number;y:number;width:number;height:number}
export interface Extent {width:number;height:number}
export function constrainDetail(rect:DetailRect,extent:Extent):DetailRect {
  const width=Math.min(Math.max(240,rect.width),Math.max(1,extent.width-24));
  const height=Math.min(Math.max(180,rect.height),Math.max(1,extent.height-24));
  return {width,height,x:Math.max(12,Math.min(extent.width-width-12,rect.x)),y:Math.max(12,Math.min(extent.height-height-12,rect.y))};
}
/** Compact per-view geometry only: proportions survive canvas changes and
 * separate native windows without persisting any owner payload. */
export function useDetailGeometry(id:string,extent:Extent) {
  const key=`oi-cradle.knowledge-detail.v1:${id}`;
  const valid=(r:DetailRect|undefined)=>r&&[r.x,r.y,r.width,r.height].every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1)&&r.width>0&&r.height>0;
  const [saved,setSaved]=useState<{wide?:DetailRect;compact?:DetailRect}>(()=>{
    try{const r=JSON.parse(localStorage.getItem(key)??"null");if(valid(r))return {wide:r};if(r)return {wide:valid(r.wide)?r.wide:undefined,compact:valid(r.compact)?r.compact:undefined};}catch{/* Invalid state falls back to responsive defaults. */}return {};
  });
  const [storageError,setStorageError]=useState<string>();
  const mode=extent.width<560?"compact":"wide",record=saved[mode];
  const initial={x:16,y:16,width:mode==="compact"?Math.min(360,extent.width-32):Math.min(400,extent.width*.42),height:Math.min(380,extent.height*.6)};
  const rect=constrainDetail(record?{x:record.x*extent.width,y:record.y*extent.height,width:record.width*extent.width,height:record.height*extent.height}:initial,extent);
  const change=(next:DetailRect)=>{const r=constrainDetail(next,extent);setSaved(previous=>({...previous,[mode]:{x:r.x/extent.width,y:r.y/extent.height,width:r.width/extent.width,height:r.height/extent.height}}));};
  const latest=useRef(saved);latest.current=saved;
  const persist=useCallback(()=>{try{localStorage.setItem(key,JSON.stringify(latest.current));setStorageError(undefined);}catch{setStorageError("The detail panel position and size could not be saved on this device.");}},[key]);
  useEffect(()=>{const timer=setTimeout(persist,200);return()=>clearTimeout(timer);},[saved,persist]);
  useEffect(()=>()=>persist(),[persist]);
  return {rect,change,storageError};
}
/** Pick the largest remaining rectangle. This is a view-space exclusion, not
 * a relation, an expression intent, or a mutation of the owner graph. */
export function freeGraphRegion(panel:DetailRect,extent:Extent):DetailRect {
  return [
    {x:0,y:0,width:Math.max(0,panel.x-20),height:extent.height},
    {x:panel.x+panel.width+20,y:0,width:Math.max(0,extent.width-panel.x-panel.width-20),height:extent.height},
    {x:0,y:0,width:extent.width,height:Math.max(0,panel.y-20)},
    {x:0,y:panel.y+panel.height+20,width:extent.width,height:Math.max(0,extent.height-panel.y-panel.height-20)},
  ].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
}

export type ResizeHandle="nw"|"n"|"ne"|"e"|"se"|"s"|"sw"|"w";
/** Keep opposite edges anchored while each edge/corner is resized. */
export function resizeDetail(rect:DetailRect,handle:ResizeHandle,dx:number,dy:number,extent:Extent):DetailRect {
  let left=rect.x,top=rect.y,right=rect.x+rect.width,bottom=rect.y+rect.height;
  const minWidth=Math.min(240,extent.width-24),minHeight=Math.min(180,extent.height-24);
  if(handle.includes("w"))left=Math.max(12,Math.min(right-minWidth,left+dx));
  if(handle.includes("e"))right=Math.min(extent.width-12,Math.max(left+minWidth,right+dx));
  if(handle.includes("n"))top=Math.max(12,Math.min(bottom-minHeight,top+dy));
  if(handle.includes("s"))bottom=Math.min(extent.height-12,Math.max(top+minHeight,bottom+dy));
  return {x:left,y:top,width:right-left,height:bottom-top};
}
