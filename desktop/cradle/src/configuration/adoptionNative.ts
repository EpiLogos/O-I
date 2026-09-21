import type {KernelOp, KernelOutcome} from "../kernel/types";
import type {AdoptionNative, AdoptionReply, AdoptionRequest} from "./adoptionController";
/** Production transport only; tests inject a controlled endpoint, never a fixture switch. */
export function createAdoptionNative(invoke: (op: KernelOp) => Promise<{outcome: KernelOutcome | null; error?: string}>): AdoptionNative {
  return {async request(request: AdoptionRequest): Promise<AdoptionReply> {
    const response = await invoke({op: "setup", request});
    if (response.error) throw new Error(response.error);
    if (response.outcome?.result !== "setup_reading") throw new Error("The native adoption operation is unavailable in this kernel.");
    return response.outcome.data as unknown as AdoptionReply;
  }};
}
