import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
export interface FlowRecord {flow_ref:string;source_ref:string;path:string;current_revision:string;scope_ref:string;privacy:string;title?:string}
export interface FlowInspection {flow:FlowRecord;capabilities:{read:{available:boolean;reason?:string|null};write:{available:boolean;reason?:string|null};history:{available:boolean;reason?:string|null}}}
export type FlowRequest={action:"flow_inspect";project:string|null;flow_ref:string}|{action:"flow_create";project:string|null;actor:string;actor_kind:"human";local_stamp?:string;path?:string;title?:string}|{action:"flow_read";project:string|null;flow_ref:string}|{action:"flow_write";project:string|null;flow_ref:string;expected_revision:string;content:string;actor:string;actor_kind:"human"};
export async function flow(transport:KernelTransportStatus,request:FlowRequest):Promise<{flow:FlowRecord;content?:string}>{
 const result=await kernelOp(transport,{op:"flow",request});if(result.error||result.outcome?.result!=="flow")throw new Error(result.error??"Central did not return the Flow");
 const response=result.outcome.response;
 if(response.kind==="failure")throw new Error(response.error.message??response.error.detail??"Central refused this Flow operation");
 if(!("reading" in response)||!response.reading?.flow)throw new Error("Central returned no Flow reading");
 return response.reading;
}

/** Preserve the owner's capability disclosure; absence never enables writing. */
export async function inspectFlow(transport:KernelTransportStatus,project:string|null,flow_ref:string):Promise<FlowInspection>{
 const result=await kernelOp(transport,{op:"flow",request:{action:"flow_inspect",project,flow_ref}});
 if(result.error||result.outcome?.result!=="flow")throw new Error(result.error??"Central did not return Flow availability");
 const response=result.outcome.response;
 if(response.kind==="failure")throw new Error(response.error.message??response.error.detail??"Central refused Flow inspection");
 if(response.kind!=="flow_inspection"||!response.inspection?.flow||!response.inspection?.capabilities)throw new Error("Central returned no Flow capability disclosure");
 return response.inspection;
}
