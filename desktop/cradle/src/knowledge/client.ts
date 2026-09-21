import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus, KnowledgeRequest} from "../kernel/types";
import {KnowledgeReadCoordinator} from "./requests";

const reads = new KnowledgeReadCoordinator();
export interface KnowledgeReadOptions {signal?: AbortSignal; fresh?: boolean}
/** Native owners keep ranking, content and retained cache authority. Only
 * equivalent in-flight READS are shared here; recording Use always executes. */
export async function knowledge<T>(transport: KernelTransportStatus, project: string | undefined, request: KnowledgeRequest, options: KnowledgeReadOptions = {}): Promise<T> {
  const run = async () => {
    const response = await kernelOp(transport, {op: "knowledge", project, request, ...(options.fresh ? {fresh:true} : {})});
    if (response.error || response.outcome?.result !== "knowledge") throw new Error(response.error ?? "AIKit did not return the requested reading");
    return response.outcome.data as T;
  };
  if (request.action === "use") { options.signal?.throwIfAborted(); return run(); }
  const key = JSON.stringify([transport, project ?? null, request, options.fresh ?? false]);
  return reads.read(key, run, options.signal);
}
