import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
export interface FlowRecord {flow_ref:string;source_ref:string;path:string;current_revision:string;scope_ref:string;privacy:string;title?:string}
export type FlowRequest={action:"flow_create";project:string;actor:string;actor_kind:"human";path:string;title:string}|{action:"flow_read";project:string;flow_ref:string}|{action:"flow_write";project:string;flow_ref:string;expected_revision:string;content:string;actor:string;actor_kind:"human"};
export async function flow(transport:KernelTransportStatus,request:FlowRequest):Promise<{flow:FlowRecord;content?:string}>{
 const result=await kernelOp(transport,{op:"flow",request});if(result.error||result.outcome?.result!=="flow")throw new Error(result.error??"Central did not return the Flow");
 const response=result.outcome.response;
 if(response.kind==="failure")throw new Error(response.error.message??response.error.detail??"Central refused this Flow operation");
 if(!response.reading?.flow)throw new Error("Central returned no Flow reading");
 return response.reading;
}
