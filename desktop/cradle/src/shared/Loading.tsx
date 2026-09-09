import {useEffect,useRef} from "react";
import {createLoadingIndicator,createPointClusters} from "@epilogos/oi-design-system/loading";
import "@epilogos/oi-design-system/point-cloud.css";
/** Only mount while the named native operation is actually pending.
 * The identity mark belongs to full-window bootstrap, not every pane. */
export function Loading({label,detail,scope="inline"}:{label:string;detail?:string;scope?:"inline"|"surface"|"window"}) {
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
 const body=createLoadingIndicator({label,detail,scope});
 const clusters=scope!=="window"?createPointClusters({active:false}):undefined;
 if(clusters){body.element.querySelector('.oi-loading-mark')?.replaceWith(clusters.element);body.element.querySelector('.oi-loading-fallback')?.remove();}
 host.current?.append(body.element);
 let visible=false;
 const update=()=>{const active=!document.hidden&&visible;body.update({active});clusters?.setActive(active);};
 const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);update();});
 observer.observe(body.element);
 document.addEventListener("visibilitychange",update);
 return()=>{observer.disconnect();document.removeEventListener("visibilitychange",update);body.remove();};},[label,detail,scope]);
 return <div ref={host}/>;
}
