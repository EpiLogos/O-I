import {useEffect,useRef} from "react";
import {createLoadingIndicator,createPointClusters} from "@epilogos/oi-design-system/loading";
import "@epilogos/oi-design-system/point-cloud.css";
import {emitExpressionCue} from "../stage/cues";
/** Only mount while the named native operation is actually pending.
 * The identity mark belongs to full-window bootstrap, not every pane.
 * Pending is also stated as a semantic cue (`surface.loading` /
 * `surface.ready`): the DOM keeps the meaningful status text, and a
 * published Expression may answer the cue at the stage. */
export function Loading({label,detail,scope="inline"}:{label:string;detail?:string;scope?:"inline"|"surface"|"window"}) {
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
 emitExpressionCue({kind:"surface.loading",label,detail});
 const body=createLoadingIndicator({label,detail,scope});
 const clusters=scope!=="window"?createPointClusters({active:false}):undefined;
 if(clusters){body.element.querySelector('.oi-loading-mark')?.replaceWith(clusters.element);body.element.querySelector('.oi-loading-fallback')?.remove();}
 host.current?.append(body.element);
 let visible=false;
 const update=()=>{const active=!document.hidden&&visible;body.update({active});clusters?.setActive(active);};
 const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);update();});
 observer.observe(body.element);
 document.addEventListener("visibilitychange",update);
 return()=>{observer.disconnect();document.removeEventListener("visibilitychange",update);body.remove();emitExpressionCue({kind:"surface.ready",label});};},[label,detail,scope]);
 return <div ref={host}/>;
}
