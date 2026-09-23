import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
/** Central's native NOW contract (native #195/#197/#199 and their compatible successors); field names
 * and schemas are the owner's, carried verbatim. Read-only: the desktop
 * renders the relations a record discloses — it never allocates, re-enters,
 * or mutates a NOW clearing. */
export type NowRequest =
  | {kind:"list";participant_refs?:string[]}
  | {kind:"read";now_ref:string};
/** One `central.now.list` row (owner's own shape, `central.now-listing/v1`). */
export interface NowRow {now_ref:string;source_ref:string;scope_ref:string;task_ref:string;purpose:string;participant_refs:string[];source_refs:string[];lifecycle:string;created_at_unix_seconds:number;revision:string;work_refs?:WorkRef[]}
/** The full `central.now-reading/v1` payload: the record plus its source identity. */
export interface NowReading {schema:"central.now-reading/v1";record:{schema:string;now_ref:string;source_ref:string;scope_ref:string;task_ref:string;purpose:string;participant_refs:string[];source_refs:string[];policy_revision_at_allocation:string;created_at_unix_seconds:number;lifecycle:string;obligations:string[];continuation_refs:string[];archive_ref?:string|null;parent_now_ref?:string|null;day_ref?:string|null;work_refs?:WorkRef[]};returns?:NowReturn[];source:{ref:string;path:string};revision:{revision:string;byte_len?:number};automatic_agent_or_model_invocation:boolean;placement_included?:boolean;[field:string]:unknown}
export interface NowListing {schema:"central.now-listing/v1";records:NowRow[];automatic_agent_or_model_invocation:boolean}
export interface WorkRef {repo:string;branch:string;worktree_path?:string|null}
export interface NowReturn {return_ref:string;status:string;settled:boolean;schema?:string|null;run_ref?:string|null;session_ref?:string|null;day_ref?:string|null;task_ref?:string|null;source_ref?:string|null}
function record(value:unknown):value is Record<string,unknown> {
 return !!value && typeof value === "object" && !Array.isArray(value);
}
function refs(value:unknown):value is string[] {return Array.isArray(value)&&value.every(v=>typeof v==="string");}
function works(value:unknown):boolean {return value===undefined || (Array.isArray(value)&&value.every(v=>record(v)&&typeof v.repo==="string"&&typeof v.branch==="string"&&(v.worktree_path==null||typeof v.worktree_path==="string")));}
export function validateNow(value:unknown,request:NowRequest):NowReading|NowListing {
 if(!record(value))throw new Error("Central NOW returned no reading");
 if(value.automatic_agent_or_model_invocation!==false)throw new Error("NOW reading violated passive-read semantics");
 if(request.kind==="list") {
  if(value.schema!=="central.now-listing/v1"||!Array.isArray(value.records))throw new Error("Unsupported NOW listing; absence is not empty success");
  for(const row of value.records) {
   if(!record(row)||typeof row.now_ref!=="string"||typeof row.scope_ref!=="string"||typeof row.purpose!=="string"||!refs(row.source_refs)||!refs(row.participant_refs)||!works(row.work_refs))throw new Error("Malformed native NOW listing row");
  }
  return value as unknown as NowListing;
 }
 const r=value.record;
 if(value.schema!=="central.now-reading/v1"||!record(r)||r.now_ref!==request.now_ref||!record(value.source)||typeof value.source.ref!=="string"||!record(value.revision)||typeof value.revision.revision!=="string")throw new Error("Unsupported or redirected NOW reading");
 for(const field of ["participant_refs","source_refs","continuation_refs","obligations"])if(!refs(r[field]))throw new Error(`NOW record has no ${field} reference array`);
 if(!works(r.work_refs))throw new Error("Malformed native NOW work references");
 // An older reader may omit Returns, but a malformed present field cannot
 // acquire the meaning of an empty successful reading.
 if(value.returns!==undefined) {
  if(!Array.isArray(value.returns))throw new Error("Malformed native NOW Returns");
  for(const returned of value.returns) {
   if(!record(returned)||typeof returned.return_ref!=="string"||typeof returned.status!=="string"||typeof returned.settled!=="boolean")throw new Error("Malformed native NOW Return");
   for(const key of ["run_ref","session_ref","day_ref","task_ref","source_ref"])if(returned[key]!=null&&typeof returned[key]!=="string")throw new Error(`Malformed native Return ${key}`);
  }
 }
 return value as unknown as NowReading;
}
export async function nowReading<T extends NowReading|NowListing>(transport:KernelTransportStatus,project:string|null,request:NowRequest):Promise<T> {
  const result=await kernelOp(transport,{op:"now",project,request});
  if(result.error || result.outcome?.result!=="now_reading")throw new Error(result.error??"Central NOW reading is unavailable");
  return validateNow(result.outcome.data,request) as T;
}
