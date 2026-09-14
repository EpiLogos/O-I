import type {DevelopmentFieldReading} from "../kernel/types";
import type {ReturnedDocumentReading, ReturnedOutstanding, ReturnedRuntimeObservation} from "./types";

/**
 * Turn one AIKit Development Field reading into the shared returned-document
 * input. This is deliberately a projection only: it exposes the native Git
 * basis, including a dirty developer executable or unavailable observation,
 * without inspecting the checkout or offering Git actions in React.
 */
export function developmentFieldGitDocument(reading: DevelopmentFieldReading): ReturnedDocumentReading {
  const git = reading.git;
  const repository = git?.world.repository;
  const diff = git?.current_diff_from_base;
  const availability = reading.git_basis;
  const outstanding: ReturnedOutstanding[] = [];
  if (availability.state !== "available") {
    outstanding.push({label: "Git observation unavailable", detail: availability.reason ?? `AIKit reported Git basis ${availability.state}.`});
  }
  if (diff?.truncated) outstanding.push({label: "Diff was truncated", detail: "AIKit limited the tracked patch; untracked paths remain listed separately."});
  if (reading.truncated) outstanding.push({label: "Development Field subjects were truncated", detail: "AIKit limited the bounded subject reading."});
  const runtime: ReturnedRuntimeObservation[] = [
    {label: "AIKit executable", value: reading.executable_basis.executable, standing: "observed"},
    {label: "Executable modality", value: reading.executable_basis.modality, standing: "observed"},
    {label: "Executable source standing", value: reading.executable_basis.source_dirty ? "dirty developer/source executable" : "clean source basis", standing: "observed"},
  ];
  if (reading.executable_basis.source_revision) runtime.push({label: "Executable source revision", value: reading.executable_basis.source_revision, standing: "observed"});
  const material = diff ? [{
    kind: "diff" as const,
    label: `Working difference from ${diff.base_revision}`,
    description: diff.truncated ? "AIKit supplied a truncated tracked patch." : "AIKit supplied the tracked patch.",
    ref: `base ${diff.base_revision}  observed HEAD ${diff.observed_head}`,
  }] : [];
  const provenance = [
    {label: "AIKit reading", value: reading.version},
    {label: "Git basis", value: availability.state},
    ...(availability.reason ? [{label: "Git basis detail", value: availability.reason}] : []),
    ...(repository ? [
      {label: "Repository root", value: repository.repository_root},
      {label: "Observed worktree", value: repository.worktree_root},
      {label: "Observed HEAD", value: repository.head},
      {label: "Observed branch", value: repository.branch},
    ] : []),
    ...(git?.base_revision ? [{label: "Requested base revision", value: git.base_revision}] : []),
  ];
  return {
    variant: "code",
    subject: {title: repository ? `${repository.branch}  Git working state` : "Git working state"},
    outcome: {summary: repository ? `AIKit observed ${repository.worktree_root} at ${repository.head}.` : "AIKit did not provide a Git observation.", standing: availability.state},
    material,
    evidence: [],
    runtime,
    outstanding,
    continuations: [],
    provenance,
  };
}
