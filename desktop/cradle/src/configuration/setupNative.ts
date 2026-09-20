/** Native picker/first-use adapters. These reuse existing KernelOps; they
 * never read a private file directly, execute shell text, create a Project,
 * or automatically invoke an Agent. Shell navigation remains Track 1's.
 */
import type {KernelOp, KernelOutcome, NativeDirectory, SourceBufferState, SourceListingState} from "../kernel/types";

export interface SetupNative {
  listDirectory(path: string): Promise<NativeDirectory>;
  listSources(): Promise<SourceListingState>;
  openSource(source_ref: string, project?: string): Promise<SourceBufferState>;
}
export type SetupOpCall = (op: KernelOp) => Promise<{outcome: KernelOutcome | null; error?: string}>;

export function createSetupNative(call: SetupOpCall): SetupNative {
  return {
    async listDirectory(path) {
      const reply = await call({op: "files_list", path, fresh: true});
      if (reply.error || reply.outcome?.result !== "directory_read") throw new Error("Native directory reading is unavailable.");
      return reply.outcome.directory;
    },
    async listSources() {
      const reply = await call({op: "sources_list"});
      if (reply.error || reply.outcome?.result !== "sources_listed") throw new Error("Native source listing is unavailable.");
      return reply.outcome.listing;
    },
    async openSource(source_ref, project) {
      const reply = await call({op: "source_open", source_ref, ...(project ? {project} : {})});
      if (reply.error || reply.outcome?.result !== "source_opened") throw new Error("The native owner could not open this source.");
      if (reply.outcome.buffer.source_ref !== source_ref) throw new Error("The returned source does not match the selected reference.");
      return reply.outcome.buffer;
    },
  };
}
