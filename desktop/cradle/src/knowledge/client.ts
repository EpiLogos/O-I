import { kernelOp } from "../kernel/bridge";
import type { KernelTransportStatus, KnowledgeRequest } from "../kernel/types";
/** Read models stay local to the requesting surface, not a second index. */
export async function knowledge<T>(transport: KernelTransportStatus, project: string | undefined, request: KnowledgeRequest): Promise<T> {
  const response = await kernelOp(transport, {op: "knowledge", project, request});
  if (response.error || response.outcome?.result !== "knowledge") throw new Error(response.error ?? "AIKit did not return the requested reading");
  return response.outcome.data as T;
}
