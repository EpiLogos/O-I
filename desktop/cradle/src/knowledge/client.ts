import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus, KnowledgeRequest} from "../kernel/types";
import {KnowledgeReadCoordinator} from "./requests";

const reads = new KnowledgeReadCoordinator();
export interface KnowledgeReadOptions {signal?: AbortSignal; fresh?: boolean}
const SUPERSEDED = "superseded";
// Bounded, never infinite. The coordinator already serialises this realm's
// own concurrent reads of one resource (requests.ts), but a second, entirely
// separate reader of the identical owner resource — another window/iframe
// over the same kernel, outside this coordinator's reach — can still win the
// kernel's own ticket once in a while; a single retry can itself lose that
// race. A short bounded number of attempts absorbs that residual, genuinely
// rare double-collision without ever looping forever.
const SUPERSEDED_READ_ATTEMPTS = 3;
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
    let last: unknown;
    for (let index = 0; index < SUPERSEDED_READ_ATTEMPTS; index++) {
      try {
        return await attempt(index > 0 ? true : (options.fresh ?? false));
      } catch (error) {
        last = error;
        // The kernel's read ticket can be superseded by something wholly
        // unrelated to this read's own resource (a concurrent ground/world
        // change, another identical concurrent read finishing first) — its
        // own error names this as retryable ("read again"). A source that
        // genuinely changed underneath fails every attempt the same honest
        // way and is reported, never masked.
        if (!(error instanceof Error && error.message.includes(SUPERSEDED))) throw error;
      }
    }
    throw last;
  };
  const key = JSON.stringify([transport, project ?? null, request, options.fresh ?? false]);
  // The resource identity omits `fresh`: an explicit-fresh read and an
  // ordinary read of the identical owner reading name the same kernel read
  // ticket, and running both at once would supersede one by accident of
  // timing (see the coordinator's per-resource serialisation).
  const resource = JSON.stringify([transport, project ?? null, request]);
  return reads.read(key, run, options.signal, resource);
}
