import type {SurfaceBinding} from "../surface/types";
import type {SelectionSnapshot} from "./nativeContext";
export interface SelectionCandidate {
 /** Local transient adapter only; never serialized into native context. */
 prepare?:()=>void;
 bindingId:string;kind:string;text:string;sourceRef?:string;start?:number;end?:number;
 revision?:string;workingCopy?:boolean;capturedAt?:string;observationKey?:string;
 documentId?:string;selector?:string;role?:string;nodeRef?:string;pageUrl?:string;error?:string;
 bounds?:{x:number;y:number;width:number;height:number};
}
export function exactText(candidate:Pick<SelectionCandidate,"text"|"start"|"end">,content:string):boolean{
 return Number.isSafeInteger(candidate.start)&&Number.isSafeInteger(candidate.end)&&candidate.start!>=0&&candidate.end!>candidate.start!&&candidate.end!<=content.length&&content.slice(candidate.start,candidate.end)===candidate.text;
}
export function selectionSnapshot(candidate:SelectionCandidate,binding:SurfaceBinding,basis:{revision?:string;workingCopy?:boolean}={}):SelectionSnapshot{
 if(candidate.error)throw new Error(candidate.error);
 if(!candidate.text.trim()||candidate.text.length>65536||candidate.text.includes('\0'))throw new Error("Select between 1 and 65,536 characters; selections are never truncated");
 const source=candidate.kind==="element"?(candidate.sourceRef??binding.ref):binding.ref;
 if(!source)throw new Error("This selection has no attributable source or page URL");
 const observation=candidate.kind==="element";
 if(observation&&(!candidate.observationKey||!candidate.documentId||!candidate.selector))throw new Error("Select this component again to capture its document identity");
 const revision=candidate.revision??basis.revision;
 if(!observation&&(!revision||!Number.isSafeInteger(candidate.start)||!Number.isSafeInteger(candidate.end)||candidate.start!<0||candidate.end!-candidate.start! !== candidate.text.length))throw new Error("Select an exact source range with a current revision");
 return {source_ref:source,source_revision:revision??null,source_project:binding.project??null,title:binding.title,owner:binding.kind==="browser"?"browser":"Central",binding_id:binding.id,text:candidate.text,working_copy:basis.workingCopy??candidate.workingCopy??false,captured_at:candidate.capturedAt??new Date().toISOString(),anchor:observation?{kind:"observation",document_id:candidate.documentId!,key:candidate.observationKey!,selector:candidate.selector!,role:candidate.role??"element",node_ref:candidate.nodeRef??null,url:candidate.pageUrl??null}:{kind:"text",start:candidate.start!,end:candidate.end!}};
}
