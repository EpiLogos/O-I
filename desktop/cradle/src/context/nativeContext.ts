import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
/** Wire projection of AIKit's encounter/context contract. The owner generates
 * item IDs, ASTs, canonical syntax and digest; the desktop never parses Vāk. */
export interface SelectionSnapshot {
 source_ref:string;source_revision?:string|null;source_project?:string|null;
 title:string;owner:string;binding_id:string;text:string;working_copy:boolean;captured_at:string;
 anchor:{kind:"text";start:number;end:number}|{kind:"observation";document_id:string;key:string;selector:string;role:string;node_ref?:string|null;url?:string|null};
}
export interface PreparedItem {id:string;selection:SelectionSnapshot;expression:unknown;canonical_expression:string}
export interface PreparedContext {schema:"aikit.prepared-context/v1";scope:{project:string;agent_session:string|null};revision:number;digest:string;items:PreparedItem[]}
export interface ContextExpectation {scope:PreparedContext["scope"];revision:number;digest:string;reviewed:string[]}
export type ContextMutation={operation:"add";selection:SelectionSnapshot;expression?:string}|{operation:"remove";id:string}|{operation:"clear"};
export type ContextOperation={operation:"read"}|{operation:"edit";basis:number;mutation:ContextMutation}|{operation:"adopt";basis:number;project_basis:number};
export const PREPARED_CONTEXT_CHANGED="oi:prepared-context-changed";

export function assertPreparedContext(value:unknown,session?:string):asserts value is PreparedContext {
 const c=value as PreparedContext;
 if(c?.schema!=="aikit.prepared-context/v1"||!Number.isSafeInteger(c.revision)||c.revision<0||typeof c.digest!=="string"||!c.digest.startsWith("blake3:")||!c.scope||typeof c.scope.project!=="string"||c.scope.agent_session!==(session??null)||!Array.isArray(c.items)||c.items.length>32)throw new Error("AIKit returned an incompatible or differently scoped prepared-context reading");
 for(const item of c.items){const s=item?.selection;if(typeof item?.id!=="string"||typeof item?.canonical_expression!=="string"||!s||typeof s.text!=="string"||s.text.length>262144||typeof s.source_ref!=="string"||typeof s.title!=="string"||typeof s.binding_id!=="string"||!s.anchor)throw new Error("AIKit returned an invalid selection");
  if(s.anchor.kind==="text"&&(!Number.isSafeInteger(s.anchor.start)||!Number.isSafeInteger(s.anchor.end)||s.anchor.start<0||s.anchor.end-s.anchor.start!==s.text.length))throw new Error("AIKit returned an invalid UTF-16 selection range");
  if(s.anchor.kind!=="text"&&s.anchor.kind!=="observation")throw new Error("Unknown native selection anchor");
 }
}
export async function nativeContext(transport:KernelTransportStatus,project:string,session:string|undefined,request:ContextOperation={operation:"read"}):Promise<PreparedContext>{
 const response=await kernelOp(transport,{op:"encounter",project,request:{action:"context",agent_session:session,request}});
 if(response.error||response.outcome?.result!=="encounter_reading")throw new Error(response.error??"The native prepared-context operation is unavailable");
 const data=response.outcome.data;assertPreparedContext(data,session);return data;
}
export function announceContext(project:string,value:PreparedContext){window.dispatchEvent(new CustomEvent(PREPARED_CONTEXT_CHANGED,{detail:{project,value}}));}
export function contextExpectation(value:PreparedContext):ContextExpectation{return {scope:value.scope,revision:value.revision,digest:value.digest,reviewed:value.items.map(item=>item.id)};}

// One validator for the current host's exact source/observation view. It
// supplies currency observations only; owner revision/digest checks still
// happen atomically at the native dispatch boundary.
type Validator=(item:PreparedItem)=>Promise<void>;
let validator:Validator|undefined;
const snapshotApprovals=new Set<string>();
const approvalKey=(context:PreparedContext,item:PreparedItem)=>JSON.stringify([context.scope,context.revision,context.digest,item.id]);
export function registerSelectionValidator(next:Validator){validator=next;return()=>{if(validator===next)validator=undefined;};}
export function approveCapturedSnapshot(context:PreparedContext,item:PreparedItem){if(snapshotApprovals.size>=64)snapshotApprovals.clear();snapshotApprovals.add(approvalKey(context,item));}
export async function validatePreparedItem(item:PreparedItem,context?:PreparedContext){if(context&&snapshotApprovals.has(approvalKey(context,item)))return;if(!validator)throw new Error("Open the source or explicitly review its captured snapshot in Context before sending");await validator(item);}
export async function reviewedContext(transport:KernelTransportStatus,project:string,session:string):Promise<ContextExpectation>{
 const value=await nativeContext(transport,project,session);for(const item of value.items)await validatePreparedItem(item,value);return contextExpectation(value);
}
export function clearSnapshotApprovals(){snapshotApprovals.clear();}
