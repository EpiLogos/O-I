import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus, KnowledgeRequest} from "../kernel/types";
import {KnowledgeReadCoordinator} from "./requests";

const reads = new KnowledgeReadCoordinator();
export interface KnowledgeReadOptions {signal?: AbortSignal; fresh?: boolean}
const SUPERSEDED = "superseded";
/** Native owners keep ranking, content and retained cache authority. Only
 * equivalent in-flight READS are shared here; recording Use always executes. */
export async function knowledge<T>(transport: KernelTransportStatus, project: string | undefined, request: KnowledgeRequest, options: KnowledgeReadOptions = {}): Promise<T> {
  const attempt = async (fresh: boolean) => {
    const response = await kernelOp(transport, {op: "knowledge", project, request, ...(fresh ? {fresh: true} : {})});
    if (response.error || response.outcome?.result !== "knowledge") throw new Error(response.error ?? "AIKit did not return the requested reading");
    return response.outcome.data as T;
  };
  if (request.action === "use") { options.signal?.throwIfAborted(); return attempt(options.fresh ?? false); }
  const run = async () => {
    try {
      return await attempt(options.fresh ?? false);
    } catch (error) {
      // The kernel's read ticket can be superseded by something wholly
      // unrelated to this read's own resource (a concurrent ground/world
      // change, another identical concurrent read finishing first) — its
      // own error names this as retryable ("read again"). One retry, on
      // an explicitly fresh basis, resolves the benign case; a source that
      // genuinely changed underneath fails the retry the same honest way
      // and is reported, never masked, never retried again.
      if (error instanceof Error && error.message.includes(SUPERSEDED)) return await attempt(true);
      throw error;
    }
  };
  const key = JSON.stringify([transport, project ?? null, request, options.fresh ?? false]);
  return reads.read(key, run, options.signal);
}
