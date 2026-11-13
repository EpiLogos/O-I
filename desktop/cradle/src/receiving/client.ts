import {actionData,kernelOp,type KernelOpCall} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
/** Central's native receiving/document contract (installed frozen cut);
 * field names and statuses are the owner's, carried verbatim. */
export type ReceivingRequest =
  | {kind:"list";after?:number;limit?:number;open?:boolean}
  | {kind:"read";return_ref:string}
  /** A contribution to a document. `declared_producer` names whose work the carrier delivers (Central keeps the carrier as the
   * author and the producer as its declaration): the person quoting Nara's answer into the Day names Nara's session. */
  | {kind:"submit";producer_key:string;source_ref:string;document_id:string;expected_source_revision:string;occurred_at_unix_seconds:number;task_ref?:string;proposal:Record<string,unknown>;declared_producer?:DeclaredProducer}
  /** Ask the person to decide: a request Return with no document target. */
  | {kind:"ask";producer_key:string;occurred_at_unix_seconds:number;request:OwnerRequest;summary?:string;evidence_refs?:string[];declared_producer?:DeclaredProducer;now_ref?:string;task_ref?:string}
  | {kind:"document";source_ref:string;document_id:string}
  | {kind:"review";return_ref:string;expected_return_revision:string;disposition:ReviewDisposition;expected_source_revision?:string;note?:string;answer?:string}
  | {kind:"include";return_ref:string;expected_return_revision:string;expected_source_revision?:string;realisation_ref?:string;realisation_owner_ref?:string}
  | {kind:"recover";return_ref:string;expected_return_revision:string}
  | {kind:"mutate-field";source_ref:string;document_id:string;expected_revision:string;request_id:string;field_id:string;value:unknown}
  /** A page's own metadata (title.set, summary.set, lifecycle.set): human-only, CAS-checked, deduplicated like a field. */
  | {kind:"mutate-meta";source_ref:string;document_id:string;expected_revision:string;request_id:string;key:"title"|"summary"|"lifecycle";value:string};
/** What the kernel's `receiving` op takes: Receiving's readings (kernel flow.rs `ReceivingRead`). Its writes are Central's own Actions. */
export type ReceivingWireRequest=
 | {List:{after?:number;limit?:number;open?:boolean}}|{Read:{return_ref:string}}|{Document:{source_ref:string;document_id:string}};
/** A reading as the `receiving` op carries it; null for a write. */
export function receivingWire(request:ReceivingRequest):ReceivingWireRequest|null{switch(request.kind){
 case"list":return {List:{after:request.after,limit:request.limit,open:request.open}};
 case"read":return {Read:{return_ref:request.return_ref}};
 case"document":return {Document:{source_ref:request.source_ref,document_id:request.document_id}};
 default:return null;
 }}
/** A write as Central's own Action (O-I #1002): a submission, a review, an inclusion or a recovery (`central.receiving.*`), a document's
 * field or meta (`central.document.mutate`). The input is the one the kernel's typed builder makes (flow.rs `CentralClient::receiving`):
 * `project` always — null names the root register, so no configured project is filled in for it — and every optional field only when it
 * is given. The kernel gives the person's token by what the input carries (action.rs `person_invocation`: a review, an inclusion, a
 * recovery and a mutation always; a submission when it is Nara's answer quoted in, #765, or the person's own proposal, #761). Null for a
 * reading. */
const RECEIVING_WRITES:Partial<Record<ReceivingRequest["kind"],string>>={submit:"central.receiving.submit",ask:"central.receiving.submit",review:"central.receiving.review",
 include:"central.receiving.include",recover:"central.receiving.recover","mutate-field":"central.document.mutate","mutate-meta":"central.document.mutate"};
export function receivingAction(project:string|null,request:ReceivingRequest):{action:string;input:Record<string,unknown>}|null{
 const action=RECEIVING_WRITES[request.kind];
 if(!action)return null;
 const {kind,...fields}=request as {kind:string}&Record<string,unknown>,input:Record<string,unknown>={project:project??null};
 for(const [key,value] of Object.entries(fields))if(value!==undefined&&value!==null)input[key]=value;
 // A document's field or meta is one `central.document.mutate`, its operation named: `field.set`, or the meta key's own.
 if(kind==="mutate-field")Object.assign(input,{operation:"field.set",value:fields.value??null});
 if(kind==="mutate-meta"){input.operation=`${fields.key}.set`;delete input.key;}
 return {action,input};
}
/** The kernel op one request is: a reading by the `receiving` op, a write as its Action by `act`. */
export function receivingOp(project:string|null,request:ReceivingRequest):import("../kernel/types").KernelOp{
 const write=receivingAction(project,request);
 return write?{op:"act",action:write.action,input:write.input}:{op:"receiving",project,request:receivingWire(request)!};
}
/** The owner's answer to a receiving op: the reading's data, or the Action's (its refusal in Central's own words, thrown). */
export function receivingAnswer<T>(call:KernelOpCall,request:ReceivingRequest):T{
 const write=receivingAction(null,request);
 if(write)return actionData<T>(call,write.action);
 if(call.error||call.outcome?.result!=="receiving_reading")throw new Error(call.error??"Central receiving is unavailable");
 return call.outcome.data as T;
}

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
/** One request to Central's receiving: a reading by the kernel's `receiving` op (Rust's externally tagged `ReceivingRead`), a write as
 * Central's Action through `act`. A hosted source's request goes inside `hosted_native`, as before. */
export async function receiving<T>(transport:KernelTransportStatus,project:string|null,request:ReceivingRequest,sourceWorldRef?:string):Promise<T> {
  const op=receivingOp(project,request);
  const result=await kernelOp(transport,sourceWorldRef?{op:"hosted_native",source_world_ref:sourceWorldRef,request:op}:op);
  return receivingAnswer<T>(result,request);
}
/** One human authored-field edit through the owner's `central.document.mutate`
 * `field.set` (the die face's write route). The owner CAS-checks
 * `expected_revision`, refuses non-human authors by its own law, and
 * deduplicates on `request_id`; its receipt carries the advanced revision. */
export async function mutateField(transport:KernelTransportStatus,project:string|null,input:{source_ref:string;document_id:string;expected_revision:string;field_id:string;value:unknown}):Promise<{operation_receipt?:{revision?:string;status?:string};[key:string]:unknown}> {
  const request_id=`req/desktop-${typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}`;
  return receiving(transport,project,{kind:"mutate-field",...input,request_id});
}
/** One human edit of a page's own metadata through `central.document.mutate` (`title.set`, `summary.set`, `lifecycle.set`): the
 * owner refuses non-human authors, CAS-checks `expected_revision` and deduplicates on `request_id`; its receipt carries the
 * advanced revision. */
export async function mutateMeta(transport:KernelTransportStatus,project:string|null,input:{source_ref:string;document_id:string;expected_revision:string;key:"title"|"summary"|"lifecycle";value:string}):Promise<{operation_receipt?:{revision?:string;status?:string}}> {
  const request_id=`req/desktop-${typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}`;
  return receiving(transport,project,{kind:"mutate-meta",...input,request_id});
}
