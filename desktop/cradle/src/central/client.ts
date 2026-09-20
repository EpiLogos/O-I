import {kernelOp} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {DayReading} from "../day/client";
import {validateNow,type NowListing} from "../receiving/now";
import {validateDocumentBasis} from "./dayForm";

export type CentralRequest =
 | {kind:"inspect"}
 | {kind:"source-location";source_ref:string}
 | {kind:"open-day";day_ref?:string}
 | {kind:"ensure-day";expected_time_policy_revision:string}
 | {kind:"initialise-day";day_ref:string;document_id:string;expected_revision:string;expected_policy_revision:string;form:CentralLocation;expected_form_revision:string};
export interface Reading<T> {state:"ready"|"failed"|"stale"|"denied"|"unavailable";action:string;data?:T;error?:{message?:string;code?:string};native_status?:string}
export interface SourceRow {binding:{ref:string;path:string;provenance:string;standing:string;treatment:string;roles:string[];agent_retrieval_allowed:boolean};revision:{revision:string}}
export interface TimeReading {schema:"central.civil-time-reading/v1";civil_date:string;local_time:string;revision:string;source_ref:string;policy:{timezone:string;day_boundary_minutes:number;automatic_day_rollover:boolean}}
export interface CentralGroundReading {
 schema:"oi.central-ground/v1";project:string|null;
 time:Reading<TimeReading>;day:Reading<DayReading>;now:Reading<NowListing>;
 sources:Reading<{schema:"central.source-change-horizon/v1";world_ref:string;sources:SourceRow[]}>;
 placement:Reading<{revision:string}>;
}
export interface DayOpen {schema:"oi.central-day-open/v1";project:string|null;day:DayReading;location:CentralLocation}

function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value);}
function dayData(value:unknown):DayReading {
 if(!object(value)||value.schema!=="central.day-reading/v1"||typeof value.day_ref!=="string"||!object(value.source)||typeof value.source.ref!=="string"||typeof value.source.path!=="string"||!object(value.revision)||typeof value.revision.revision!=="string"||!object(value.temporal)||value.temporal.day_ref!==value.day_ref||typeof value.temporal.civil_date!=="string")throw new Error("Malformed native Day reading");
 if(value.document_state==="ready") {
  if(!object(value.document)||typeof value.document.document_id!=="string")throw new Error("Day reports ready without a document");
  const doc=validateDocumentBasis(value.document,value.source.ref,value.document.document_id);
  if(doc.revision!==value.revision.revision||(value.document.document as Record<string,unknown>).day_ref!==value.day_ref)throw new Error("Native Day/document revision or identity differs");
 } else if(value.document_state!=="uninitialised"||value.document!=null)throw new Error("Native owner has not supplied a resolved Day/document state");
 return value as unknown as DayReading;
}
export function validateGround(value:unknown,project:string|null):CentralGroundReading {
 if(!object(value)||value.schema!=="oi.central-ground/v1"||value.project!==project)throw new Error("Central returned a different or unsupported ground");
 for(const field of ["time","day","now","sources","placement"]) {
  const item=value[field];
  if(!object(item)||!['ready','failed','stale','denied','unavailable'].includes(String(item.state))||typeof item.action!=="string")throw new Error(`Central ${field} reading has no explicit state`);
  if(item.state==="ready"&&!object(item.data))throw new Error(`Central ${field} reported success without data`);
 }
 const result=value as unknown as CentralGroundReading;
 if(result.time.state==="ready") {
  const time=result.time.data!;
  if(time.schema!=="central.civil-time-reading/v1"||typeof time.civil_date!=="string"||typeof time.revision!=="string"||!time.policy||typeof time.policy.timezone!=="string"||!Number.isInteger(time.policy.day_boundary_minutes)||time.policy.day_boundary_minutes<0||time.policy.day_boundary_minutes>=1440)throw new Error("Malformed native civil-time reading");
 }
 if(result.day.state==="ready"||result.day.data!==undefined)dayData(result.day.data);
 if(result.now.state==="ready")validateNow(result.now.data,{kind:"list"});
 if(result.sources.state==="ready") {
  const sources=result.sources.data!;
  if(sources.schema!=="central.source-change-horizon/v1"||!Array.isArray(sources.sources)||(project===null&&sources.world_ref!=="control:root"))throw new Error("Central source horizon has a different scope or no sources array");
  for(const row of sources.sources)if(!row?.binding||typeof row.binding.ref!=="string"||typeof row.binding.path!=="string"||typeof row.binding.agent_retrieval_allowed!=="boolean"||!Array.isArray(row.binding.roles))throw new Error("Malformed native source binding");
 }
 if(result.placement.state==="ready"&&typeof result.placement.data?.revision!=="string")throw new Error("No native placement basis");
 return result;
}
export function validateDayOpen(value:unknown,project:string|null):DayOpen {
 if(!object(value)||value.schema!=="oi.central-day-open/v1"||value.project!==project)throw new Error("Central returned a different Day scope");
 const day=dayData(value.day);
 if(day.document_state!=="ready"||!object(value.location)||!value.location.ref||value.location.schema!=="central.path-ref/v1"||typeof value.location.path!=="string")throw new Error("Current Day has no matched native document and source location");
 // For root, owner SourceBinding paths are root-relative. A child location
 // is joined through its actual native Project path by the kernel.
 if(project===null&&value.location.path!==day.source.path)throw new Error("Day source location was redirected");
 return value as unknown as DayOpen;
}
export async function central<T=unknown>(transport:KernelTransportStatus,project:string|null,request:CentralRequest):Promise<T> {
 const result=await kernelOp(transport,{op:"central",project,request});
 if(result.error||result.outcome?.result!=="central_reading")throw new Error(result.error??"Central did not return its native reading");
 return result.outcome.data as T;
}
export async function readGround(transport:KernelTransportStatus,project:string|null):Promise<CentralGroundReading>{return validateGround(await central(transport,project,{kind:"inspect"}),project);}
export async function openDay(transport:KernelTransportStatus,project:string|null,day_ref?:string):Promise<DayOpen>{return validateDayOpen(await central(transport,project,{kind:"open-day",day_ref}),project);}
export async function sourceLocation(transport:KernelTransportStatus,project:string|null,source_ref:string):Promise<CentralLocation>{
 const result=await central<{schema:string;project:string|null;source_ref:string;location:CentralLocation}>(transport,project,{kind:"source-location",source_ref});
 if(result.schema!=="oi.central-source-location/v1"||result.project!==project||result.source_ref!==source_ref||result.location?.schema!=="central.path-ref/v1")throw new Error("Central redirected the source location");
 return result.location;
}
