import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
export type EncounterRequest = {action:"start"|"providers"} | {action:"open";space:string;agent_session:string;provider:string} | {action:"read";agent_session:string;after:number;limit:number} | {action:"view";agent_session:string;before?:number} | {action:"draft";agent_session:string;basis:number;text:string} | {action:"prompt";agent_session:string;draft_revision:number} | {action:"cancel";agent_session:string;reason?:string} | {action:"status";agent_session:string} | {action:"permission";agent_session:string;request_id:string;decision:PermissionDecision};
export interface Draft {revision:number;text:string}
export type PermissionDecision={outcome:"selected";option_id:string}|{outcome:"cancelled"};
export interface NativePermission {native_request_id:string;native_session_id:string;tool_call_id?:string;tool_call:unknown;raw:unknown;choices:{option_id:string;label:string;kind?:string}[];provenance:string[]}
export interface EncounterAction {ref:string;enabled:boolean;reason:string|null}
export interface EncounterReading {schema?:"aikit.encounter-view/v1";agent_session:string;blocks:{id:number;kind:string;text:string}[];more:boolean;draft:Draft;connection?:EncounterStatus;permissions?:NativePermission[];permission_authority?:"native-provider-consent";actions?:EncounterAction[]}
export interface EncounterStatus {resident?:boolean;native_session_id?:string;state:string;error?:string|null;provider?:{id:string;label:string}}
export async function encounter<T>(transport:KernelTransportStatus,project:string,request:EncounterRequest):Promise<T> {
  const result=await kernelOp(transport,{op:"encounter",project,request});
  if(result.error || result.outcome?.result!=="encounter_reading")throw new Error(result.error??"AIKit did not return an encounter reading");
  return result.outcome.data as T;
}
