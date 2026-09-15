import type {DevelopmentFieldReading} from "../kernel/types";
import type {ReturnedDocumentReading, ReturnedEvidence, ReturnedOutstanding, ReturnedRuntimeObservation} from "./types";

export interface DevelopmentFieldWorktreeMismatch {
  requested: string;
  observed: string;
}

/** The requested cwd stays adapter provenance. AIKit's observed worktree is
 * authoritative for the returned Git material and can disagree with it. */
export function developmentFieldWorktreeMismatch(reading: DevelopmentFieldReading, requestedCwd: string): DevelopmentFieldWorktreeMismatch | undefined {
  const observed = reading.git?.world.repository.worktree_root;
  if (!observed || observed === requestedCwd) return undefined;
  return {requested: requestedCwd, observed};
}

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
  const evidence: ReturnedEvidence[] = [{
    label: "Verification not supplied",
    standing: "missing",
    detail: "This working-tree observation does not include test results.",
    required: true,
  }];
  const runtime: ReturnedRuntimeObservation[] = [
    {label: "AIKit executable", value: reading.executable_basis.executable, standing: "observed"},
    {label: "Executable modality", value: reading.executable_basis.modality, standing: "observed"},
    {label: "Executable source standing", value: reading.executable_basis.source_dirty ? "dirty developer/source executable" : "clean source basis", standing: "observed"},
  ];
  if (reading.executable_basis.source_revision) runtime.push({label: "Executable source revision", value: reading.executable_basis.source_revision, standing: "observed"});
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
    ...(diff ? [{label: "Compared base revision", value: diff.base_revision}, {label: "Compared observed HEAD", value: diff.observed_head}] : []),
  ];
  return {
    variant: "code",
    subject: {title: "Working changes"},
    outcome: {summary: repository ? `${repository.worktree_root.split("/").filter(Boolean).slice(-1)[0]} · ${repository.branch}` : "AIKit did not provide a Git observation.", standing: availability.state === "available" ? undefined : availability.state},
    material: [],
    evidence,
    runtime,
    outstanding,
    continuations: [],
    provenance,
  };
}
