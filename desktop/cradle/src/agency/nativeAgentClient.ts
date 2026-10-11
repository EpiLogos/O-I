import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import {NativeAgentController, type AgentOwner} from "./nativeAgent";
export function nativeAgentOwner(transport: KernelTransportStatus, project?: string, sourceWorldRef?: string): AgentOwner {
 return async request => {
  const operation = {op:"agent_definition" as const,project:project || null,request};
  const result = await kernelOp(transport,sourceWorldRef?{op:"hosted_native",source_world_ref:sourceWorldRef,request:operation}:operation);
  if (result.error || result.outcome?.result !== "agent_definition_reading") throw new Error(result.error ?? "Native Agent owner returned no reading");
  return result.outcome.data;
 };
}
// Per-disclosed-scope held forms, not renderer Agent identities. Everything
// represented as persisted is read back from Central/AIKit. Never localStorage.
const held = new Map<string,NativeAgentController>();
export function agentController(transport: KernelTransportStatus, project?: string, sourceWorldRef?: string): NativeAgentController {
 const key=JSON.stringify([transport,sourceWorldRef??null,project||null]);
 let controller=held.get(key);
 if (!controller) { controller=new NativeAgentController(nativeAgentOwner(transport,project,sourceWorldRef));held.set(key,controller); }
 else controller.bind(nativeAgentOwner(transport,project,sourceWorldRef));
 return controller;
}
