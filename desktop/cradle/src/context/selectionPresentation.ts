/** Bounded presentation of the last native prepared-context reading. No
 * persistence, source bodies, transcript or semantic authority lives here. */
export interface ContextCue {id:string;bindingId:string;viewOnly?:boolean;sourceRef?:string;start:number;end:number;text:string}
export const CONTEXT_CUES_CHANGED="oi:context-cues-changed";
let cues:readonly ContextCue[]=[];
export function setContextCues(next:readonly ContextCue[]){cues=next.slice(0,64);if(typeof window!=="undefined")window.dispatchEvent(new Event(CONTEXT_CUES_CHANGED));}
export function contextCues(sourceRef?:string,bindingId?:string):ContextCue[]{return cues.filter(item=>item.viewOnly?item.bindingId===bindingId:sourceRef?item.sourceRef===sourceRef:item.bindingId===bindingId);}
export function revealContextCue(item:ContextCue){window.dispatchEvent(new CustomEvent("oi:context-reveal",{detail:item}));}

export function getContextCues():readonly ContextCue[]{return cues;}
