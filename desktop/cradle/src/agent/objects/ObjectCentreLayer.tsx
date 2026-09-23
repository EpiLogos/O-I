import {useEffect,useState} from "react";
import {ObjectPage} from "./ObjectPage";
import {interceptObjectOpens,type ObjectRef} from "./registry";
import "./kinds";

/**
 * Full-page centres (10-SIDEBARS §4.1a, amendment A4): in Factory,
 * Expressions, Technè and Settings the main page stands full-centre with no
 * pane tab bar, so opening an object REPLACES the page in place with ← Back
 * to where you were; it never adds a tab bar. The composition root mounts
 * this layer over the centre; in Base it stands down and the frame opens the
 * page as a tab in the focused pane. Pop out always goes to the frame.
 */
export function ObjectCentreLayer({fullPage}:{fullPage:boolean}) {
 const [stack,setStack]=useState<ObjectRef[]>([]);
 useEffect(()=>{if(!fullPage)setStack([]);},[fullPage]);
 useEffect(()=>interceptObjectOpens(detail=>{
  if(!fullPage||detail.popOut)return false;
  setStack(held=>[...held.filter(entry=>!(entry.kind===detail.object.kind&&entry.ref===detail.object.ref)),detail.object]);
  return true;
 }),[fullPage]);
 const top=stack[stack.length-1];
 useEffect(()=>{
  if(!top)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!event.defaultPrevented){setStack(held=>held.slice(0,-1));}};
  window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);
 },[top]);
 if(!top)return null;
 return <div className="object-centre-layer" data-object-layer="true">
  <ObjectPage key={`${top.kind}:${top.ref}`} object={top} onBack={()=>setStack(held=>held.slice(0,-1))}/>
 </div>;
}
