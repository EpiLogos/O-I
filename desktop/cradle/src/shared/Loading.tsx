import {useEffect} from "react";
import "@epilogos/oi-design-system/point-cloud.css";
import {emitExpressionCue} from "../stage/cues";
/** Mount only while the named native operation is pending. Its status remains
 * meaningful without a renderer; a published native scene may address the cue. */
export function Loading({label,detail,scope="inline"}:{label:string;detail?:string;scope?:"inline"|"surface"|"window"}) {
 if(!label.trim())throw new TypeError("A truthful loading label is required");
 useEffect(()=>{
  emitExpressionCue({kind:"surface.loading",label,detail});
 },[label,detail]);
 return <div className="oi-loading" data-scope={scope} role="status" aria-live="polite" aria-atomic="true">
  <p className="oi-loading-label">{label}</p>{detail&&<p className="oi-loading-detail">{detail}</p>}
 </div>;
}
