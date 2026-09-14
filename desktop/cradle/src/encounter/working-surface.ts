import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
export interface WorkingSurfaceSelection {project:string;space:string;agentSession:string;surface?:string}
export interface ResolvedWorkingSurface {binding:{binding:string;surface:string;agent_session:string};service_cwd:string;observation:unknown}
export async function resolveWorkingSurface(transport:KernelTransportStatus,selection:WorkingSurfaceSelection):Promise<ResolvedWorkingSurface>{
  const result=await kernelOp(transport,{op:"session_space",project:selection.project,request:{action:"resolve_working",space:selection.space,agent_session:selection.agentSession,surface:selection.surface}});
  if(result.error)throw new Error(result.error);
  if(result.outcome?.result!=="session_space_reading")throw new Error("AIKit did not return a working Surface reading");
  const data=result.outcome.data as ResolvedWorkingSurface;
  if(!data?.binding?.binding||!data.binding.surface||data.binding.agent_session!==selection.agentSession||!data.service_cwd)throw new Error("AIKit returned an incompatible working Surface binding");
  return data;
}
