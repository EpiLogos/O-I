import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
/** Central's native NOW contract (installed cut `59bb901c19a5`); field names
 * and schemas are the owner's, carried verbatim. Read-only: the desktop
 * renders the relations a record discloses — it never allocates, re-enters,
 * or mutates a NOW clearing. */
export type NowRequest =
  | {kind:"list";participant_refs?:string[]}
  | {kind:"read";now_ref:string};
/** One `central.now.list` row (owner's own shape, `central.now-listing/v1`). */
export interface NowRow {now_ref:string;source_ref:string;scope_ref:string;task_ref:string;purpose:string;participant_refs:string[];source_refs:string[];lifecycle:string;created_at_unix_seconds:number;revision:string}
/** The full `central.now-reading/v1` payload: the record plus its source identity. */
export interface NowReading {schema:"central.now-reading/v1";record:{schema:string;now_ref:string;source_ref:string;scope_ref:string;task_ref:string;purpose:string;participant_refs:string[];source_refs:string[];policy_revision_at_allocation:string;created_at_unix_seconds:number;lifecycle:string;obligations:string[];continuation_refs:string[];archive_ref?:string|null};source:{ref:string;path:string};revision:{revision:string;byte_len?:number};automatic_agent_or_model_invocation:boolean;placement_included?:boolean;[field:string]:unknown}
export interface NowListing {schema:"central.now-listing/v1";records:NowRow[];automatic_agent_or_model_invocation:boolean}
export async function nowReading<T extends NowReading|NowListing>(transport:KernelTransportStatus,project:string|null,request:NowRequest):Promise<T> {
  const result=await kernelOp(transport,{op:"now",project,request});
  if(result.error || result.outcome?.result!=="now_reading")throw new Error(result.error??"Central NOW reading is unavailable");
  return result.outcome.data as T;
}
