import {useEffect,useRef} from "react";
import {createLoadingIndicator} from "@epilogos/oi-design-system/loading";
import "@epilogos/oi-design-system/point-cloud.css";
/** Only mount while the named native operation is actually pending. */
export function Loading({label,detail,scope="inline"}:{label:string;detail?:string;scope?:"inline"|"surface"|"window"}) {
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{const body=createLoadingIndicator({label,detail,scope});host.current?.append(body.element);
 let visible=false;
 const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);body.update({active:!document.hidden && visible});});
 observer.observe(body.element);
 const visibility=()=>body.update({active:!document.hidden && visible});
 document.addEventListener("visibilitychange",visibility);
 return()=>{observer.disconnect();document.removeEventListener("visibilitychange",visibility);body.remove();};},[label,detail,scope]);
 return <div ref={host}/>;
}
