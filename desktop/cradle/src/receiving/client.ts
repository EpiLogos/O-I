import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
/** Central's native receiving/document contract (installed frozen cut);
 * field names and statuses are the owner's, carried verbatim. */
export type ReceivingRequest =
  | {kind:"list";after?:number;limit?:number;open?:boolean}
  | {kind:"read";return_ref:string}
  | {kind:"submit";producer_key:string;source_ref:string;document_id:string;expected_source_revision:string;occurred_at_unix_seconds:number;task_ref?:string;proposal:Record<string,unknown>}
  | {kind:"document";source_ref:string;document_id:string}
  | {kind:"review";return_ref:string;expected_return_revision:string;disposition:ReviewDisposition;expected_source_revision?:string;note?:string;answer?:string}
  | {kind:"include";return_ref:string;expected_return_revision:string;expected_source_revision?:string;realisation_ref?:string;realisation_owner_ref?:string}
  | {kind:"recover";return_ref:string;expected_return_revision:string}
  | {kind:"mutate-field";source_ref:string;document_id:string;expected_revision:string;request_id:string;field_id:string;value:unknown};
export type ReceivingWireRequest=
 | {List:{after?:number;limit?:number;open?:boolean}}|{Read:{return_ref:string}}|{Submit:{producer_key:string;source_ref:string;document_id:string;expected_source_revision:string;occurred_at_unix_seconds:number;task_ref?:string;proposal:Record<string,unknown>}}
 | {Document:{source_ref:string;document_id:string}}|{Review:{return_ref:string;expected_return_revision:string;disposition:ReviewDisposition;expected_source_revision?:string;note?:string;answer?:string}}|{Include:{return_ref:string;expected_return_revision:string;expected_source_revision?:string;realisation_ref?:string;realisation_owner_ref?:string}}
 | {Recover:{return_ref:string;expected_return_revision:string}}|{MutateField:{source_ref:string;document_id:string;expected_revision:string;request_id:string;field_id:string;value:unknown}};
export function receivingWire(request:ReceivingRequest):ReceivingWireRequest{switch(request.kind){
 case"list":return {List:{after:request.after,limit:request.limit,open:request.open}};
 case"read":return {Read:{return_ref:request.return_ref}};
 case"submit":return {Submit:{producer_key:request.producer_key,source_ref:request.source_ref,document_id:request.document_id,expected_source_revision:request.expected_source_revision,occurred_at_unix_seconds:request.occurred_at_unix_seconds,task_ref:request.task_ref,proposal:request.proposal}};
 case"document":return {Document:{source_ref:request.source_ref,document_id:request.document_id}};
 case"review":return {Review:{return_ref:request.return_ref,expected_return_revision:request.expected_return_revision,disposition:request.disposition,expected_source_revision:request.expected_source_revision,note:request.note,answer:request.answer}};
 case"include":return {Include:{return_ref:request.return_ref,expected_return_revision:request.expected_return_revision,expected_source_revision:request.expected_source_revision,realisation_ref:request.realisation_ref,realisation_owner_ref:request.realisation_owner_ref}};
 case"recover":return {Recover:{return_ref:request.return_ref,expected_return_revision:request.expected_return_revision}};
 case"mutate-field":return {MutateField:{source_ref:request.source_ref,document_id:request.document_id,expected_revision:request.expected_revision,request_id:request.request_id,field_id:request.field_id,value:request.value}};
 }}

/** accepted/rejected: contributions and proposals; answered/rejected:
 * questions; pending: leave it for later; acknowledged: seen, not decided. */
export type ReviewDisposition="accepted"|"rejected"|"answered"|"pending"|"acknowledged";
export interface ContributionAuthor {principal_ref:string;actor_kind:string}
/** Whose work a credentialed carrier delivered (the carrier stays `author`). */
export interface DeclaredProducer {ref:string;actor_kind:string;attribution:"verified"|"claimed"|string}
/** An Agent asking the person to decide: a proposal of work, or a question.
 * A request targets no document; the decision is recorded on the Return. */
export interface OwnerRequest {kind:"proposal"|"question"|string;subject:string;body?:string;proposed_owner_ref?:string|null;proposal_ref?:string|null;options?:string[]}
export interface ReturnRow {return_ref:string;revision:string;sequence:number;status:"pending"|"needs-review"|"accepted"|"rejected"|"answered"|"including"|"uncertain"|"included"|string;
 /** Absent on records written before requests existed: a contribution. */
 kind?:"contribution"|"request"|string;source_ref?:string|null;document_id?:string|null;author:ContributionAuthor;declared_producer?:DeclaredProducer|null;summary?:string|null;
 request?:Pick<OwnerRequest,"kind"|"subject"|"proposed_owner_ref"|"proposal_ref">|null;acknowledged?:boolean;
 /** The owner's own reading of whether this still waits for the person. */
 settled?:boolean;occurred_at_unix_seconds?:number|null;received_at_unix_seconds:number;now_ref?:string|null;day_ref?:string|null;task_ref?:string|null;run_ref?:string|null;session_ref?:string|null}
export interface ReturnReview {reviewer_ref:string;authority_ref:string;authority_revision:string;disposition:string;source_revision?:string|null;reviewed_at_unix_seconds:number;note?:string|null;answer?:string|null}
export interface Realisation {ref:string;owner_ref:string;recorded_by:string;recorded_at_unix_seconds:number;standing:string}
export interface ReturnRecord extends Omit<ReturnRow,"request"> {proposed_source_revision?:string|null;proposal?:Record<string,unknown>|null;request?:OwnerRequest|null;evidence_refs?:string[];reply_to?:string|null;authority_ref:string;authority_revision:string;stale_at_arrival:boolean;review:ReturnReview|null;inclusion_request?:unknown;applied_source_revision?:string|null;last_error?:string|null;acknowledgement?:unknown;realisation?:Realisation|null}
export interface ReceivingPage {schema:"central.receiving-page/v1";returns:ReturnRow[];more:boolean;next_after?:number|null;withheld_unavailable_sources:number;proposal_bodies_in_page:boolean;
 /** The owner's exact count of what still waits (absent on older cuts). */
 open_total?:number}
/** A request Return: the person is asked to decide, not to include text. */
export const isRequest=(row:Pick<ReturnRow,"kind">)=>row.kind==="request";
export interface ReturnReading {schema:"central.receiving-reading/v1";return_ref:string;revision:string;record:ReturnRecord;included:boolean;source_changed_by_arrival_or_review:boolean;automatic_agent_or_model_invocation:boolean;document_result?:unknown}
export interface DocumentReading {schema:"central.document-reading/v1";source:{ref:string;path:string};revision:{revision:string;byte_len?:number};document_id:string;document:{document_id:string;kind:string;title?:string;lifecycle?:string;contributions:{id:string;html:string;author_ref:string;actor_kind:string;display_role:string;entry_id?:string|null;field_id?:string|null;locked?:boolean;human_touched?:boolean;removed?:boolean;reviewed_by?:string|null}[]};unreviewed_external_revision:boolean;source_authority:string;automatic_agent_or_model_invocation:boolean}
export async function receiving<T>(transport:KernelTransportStatus,project:string|null,request:ReceivingRequest):Promise<T> {
  // Rust's native owner request is an externally tagged enum. Keep the
  // renderer API readable, then encode exactly one owner variant here.
  const result=await kernelOp(transport,{op:"receiving",project,request:receivingWire(request)});
  if(result.error || result.outcome?.result!=="receiving_reading")throw new Error(result.error??"Central receiving is unavailable");
  return result.outcome.data as T;
}
/** One human authored-field edit through the owner's `central.document.mutate`
 * `field.set` (the die face's write route). The owner CAS-checks
 * `expected_revision`, refuses non-human authors by its own law, and
 * deduplicates on `request_id`; its receipt carries the advanced revision. */
export async function mutateField(transport:KernelTransportStatus,project:string|null,input:{source_ref:string;document_id:string;expected_revision:string;field_id:string;value:unknown}):Promise<{operation_receipt?:{revision?:string;status?:string};[key:string]:unknown}> {
  const request_id=`req/desktop-${typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}`;
  return receiving(transport,project,{kind:"mutate-field",...input,request_id});
}
