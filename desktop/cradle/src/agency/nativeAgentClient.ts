import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import {NativeAgentController, type AgentOwner} from "./nativeAgent";
export function nativeAgentOwner(transport: KernelTransportStatus, project?: string): AgentOwner {
 return async request => {
  const result = await kernelOp(transport,{op:"agent_definition",project:project || null,request});
  if (result.error || result.outcome?.result !== "agent_definition_reading") throw new Error(result.error ?? "Native Agent owner returned no reading");
  return result.outcome.data;
 };
}
// Per-disclosed-scope held forms, not renderer Agent identities. Everything
// represented as persisted is read back from Central/AIKit. Never localStorage.
const held = new Map<string,NativeAgentController>();
export function agentController(transport: KernelTransportStatus, project?: string): NativeAgentController {
 const key=JSON.stringify([transport,project||null]);
 let controller=held.get(key);
 if (!controller) { controller=new NativeAgentController(nativeAgentOwner(transport,project));held.set(key,controller); }
 else controller.bind(nativeAgentOwner(transport,project));
 return controller;
}
