import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
/** Central's native receiving/document contract (installed frozen cut);
 * field names and statuses are the owner's, carried verbatim. */
export type ReceivingRequest =
  | {kind:"list";after?:number;limit?:number}
  | {kind:"read";return_ref:string}
  | {kind:"document";source_ref:string;document_id:string}
  | {kind:"review";return_ref:string;expected_return_revision:string;disposition:"accepted"|"rejected";expected_source_revision?:string}
  | {kind:"include";return_ref:string;expected_return_revision:string;expected_source_revision:string}
  | {kind:"recover";return_ref:string;expected_return_revision:string};
export interface ContributionAuthor {principal_ref:string;actor_kind:string}
export interface ReturnRow {return_ref:string;revision:string;sequence:number;status:"pending"|"needs-review"|"accepted"|"rejected"|"including"|"uncertain"|"included"|string;source_ref:string;document_id:string;author:ContributionAuthor;occurred_at_unix_seconds?:number|null;received_at_unix_seconds:number;now_ref?:string|null;day_ref?:string|null;task_ref?:string|null;run_ref?:string|null;session_ref?:string|null}
export interface ReturnReview {reviewer_ref:string;authority_ref:string;authority_revision:string;disposition:string;source_revision:string;reviewed_at_unix_seconds:number}
export interface ReturnRecord extends ReturnRow {proposed_source_revision:string;proposal:Record<string,unknown>;authority_ref:string;authority_revision:string;stale_at_arrival:boolean;review:ReturnReview|null;inclusion_request?:unknown;applied_source_revision?:string|null;last_error?:string|null}
export interface ReceivingPage {schema:"central.receiving-page/v1";returns:ReturnRow[];more:boolean;next_after?:number|null;withheld_unavailable_sources:number;proposal_bodies_in_page:boolean}
export interface ReturnReading {schema:"central.receiving-reading/v1";return_ref:string;revision:string;record:ReturnRecord;included:boolean;source_changed_by_arrival_or_review:boolean;automatic_agent_or_model_invocation:boolean;document_result?:unknown}
export interface DocumentReading {schema:"central.document-reading/v1";source:{ref:string;path:string};revision:{revision:string;byte_len?:number};document_id:string;document:{document_id:string;kind:string;title?:string;lifecycle?:string;contributions:{id:string;html:string;author_ref:string;actor_kind:string;display_role:string;entry_id?:string|null;field_id?:string|null;locked?:boolean;human_touched?:boolean;removed?:boolean;reviewed_by?:string|null}[]};unreviewed_external_revision:boolean;source_authority:string;automatic_agent_or_model_invocation:boolean}
export async function receiving<T>(transport:KernelTransportStatus,project:string|null,request:ReceivingRequest):Promise<T> {
  const result=await kernelOp(transport,{op:"receiving",project,request});
  if(result.error || result.outcome?.result!=="receiving_reading")throw new Error(result.error??"Central receiving is unavailable");
  return result.outcome.data as T;
}
