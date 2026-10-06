/**
 * The generic adapter's hook: a linked local corpus, read through the kernel's own material/files/knowledge reads,
 * with no essay semantics. NOT BUILT YET in this slice — the field host is source-agnostic and the Epi adapter is
 * the first vertical; until this lands, the field says so rather than showing a stand-in corpus.
 */
import type {FieldSourceState} from "../useFieldSource";

export function useGenericFieldSource(_active: boolean): FieldSourceState {
  void _active;
  return {
    status: "unavailable",
    title: "No linked corpus yet",
    reason: "The generic field adapter (a linked local corpus read through Central's own file and knowledge reads) is not wired in this build. The Epi-Logos world's essay is.",
  };
}
