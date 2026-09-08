import {useEffect,useRef} from "react";
import {createLoadingIndicator} from "@epilogos/oi-design-system/loading";
import "@epilogos/oi-design-system/point-cloud.css";
/** Only mount while the named native operation is actually pending. */
export function Loading({label,detail,scope="inline"}:{label:string;detail?:string;scope?:"inline"|"surface"|"window"}) {
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{const body=createLoadingIndicator({label,detail,scope});host.current?.append(body.element);return()=>body.remove();},[label,detail,scope]);
 return <div ref={host}/>;
}
