import type {DevelopmentFieldViewSnapshot, SurfaceBinding} from "./types";

/** Bound retained owner material so layout persistence remains presentation state. */
export const DEVELOPMENT_FIELD_SNAPSHOT_MAX_BYTES = 64 * 1024;

export interface DevelopmentFieldSnapshotIdentity {
  project: string;
  cwd: string;
  requestedBase: string;
}

export function developmentFieldSnapshotError(value: unknown, expected?: DevelopmentFieldSnapshotIdentity): string | undefined {
  const snapshot = object(value);
  if (!snapshot || !text(snapshot.project) || !text(snapshot.cwd) || !text(snapshot.requestedBase)) return "missing comparison identity";
  if (!snapshot.cwd.startsWith("/")) return "requested worktree is not absolute";
  if (snapshot.resolvedBase !== undefined && !text(snapshot.resolvedBase)) return "resolved base is malformed";
  if (expected && (snapshot.project !== expected.project || snapshot.cwd !== expected.cwd || snapshot.requestedBase !== expected.requestedBase)) return "comparison identity does not match this Surface";
  const readingError = readingShapeError(snapshot.reading);
  if (readingError) return readingError;
  const diff = object(object(object(snapshot.reading)?.git)?.current_diff_from_base);
  if (snapshot.resolvedBase !== undefined && (!diff || diff.base_revision !== snapshot.resolvedBase)) return "resolved base does not match the retained native diff";
  let encoded: string;
  try { encoded = JSON.stringify(snapshot); } catch { return "cannot be serialized"; }
  if (new TextEncoder().encode(encoded).byteLength > DEVELOPMENT_FIELD_SNAPSHOT_MAX_BYTES) return `exceeds the ${DEVELOPMENT_FIELD_SNAPSHOT_MAX_BYTES}-byte presentation bound`;
  return undefined;
}

export function exactDevelopmentFieldSnapshot(value: unknown, expected: DevelopmentFieldSnapshotIdentity): DevelopmentFieldViewSnapshot | undefined {
  return developmentFieldSnapshotError(value, expected) === undefined ? value as DevelopmentFieldViewSnapshot : undefined;
}

function readingShapeError(value: unknown): string | undefined {
  const reading = object(value);
  if (!reading || reading.version !== "aikit.development-field-reading/v1") return "owner reading has an unsupported version";
  const executable = object(reading.executable_basis);
  if (!executable || !text(executable.executable) || !text(executable.package_version) || !["installed", "source", "developer", "unknown"].includes(executable.modality as string) || typeof executable.source_dirty !== "boolean" || (executable.source_revision !== undefined && !text(executable.source_revision))) return "owner executable basis is malformed";
  if (!availability(reading.git_basis)) return "owner Git availability is malformed";
  const central = object(reading.central_self_description);
  if (!central || !availability(central.availability) || !texts(central.self_description_refs)) return "owner Central basis is malformed";
  if (!Array.isArray(reading.subjects) || !reading.subjects.every(subject => { const item = object(subject); return !!item && text(item.subject) && availability(item.availability); }) || typeof reading.truncated !== "boolean") return "owner subjects are malformed";
  if (reading.git !== undefined && !gitBasis(reading.git)) return "owner Git reading is malformed";
  return undefined;
}

function gitBasis(value: unknown): boolean {
  const git = object(value), world = git && object(git.world), repository = world && object(world.repository), working = world && object(world.working), diff = git && git.current_diff_from_base;
  if (!git || !world || !repository || !working || !text(world.version) || !text(world.project) || !text(repository.branch) || typeof repository.detached !== "boolean" || !text(repository.head) || !text(repository.repository_root) || !text(repository.worktree_root) || !nonNegative(repository.ahead) || !nonNegative(repository.behind) || (repository.upstream !== undefined && repository.upstream !== null && !text(repository.upstream)) || !texts(working.conflicted) || !texts(working.staged) || !texts(working.unstaged) || !texts(working.untracked) || !Array.isArray(world.worktrees) || (git.base_revision !== undefined && !text(git.base_revision))) return false;
  if (diff === undefined) return true;
  const current = object(diff);
  return !!current && text(current.base_revision) && text(current.observed_head) && typeof current.patch === "string" && typeof current.truncated === "boolean" && texts(current.untracked_paths);
}

function availability(value: unknown): boolean { const item = object(value); return !!item && text(item.state) && (item.reason === undefined || text(item.reason)); }
function object(value: unknown): Record<string, unknown> | undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function texts(value: unknown): boolean { return Array.isArray(value) && value.every(text); }
function nonNegative(value: unknown): boolean { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }

/** Accept only view material for the held binding; a recovery notice clears the
 * old snapshot rather than making a detached refresh revert on redock. */
export function exactDevelopmentFieldView(value: unknown, expected: DevelopmentFieldSnapshotIdentity): NonNullable<NonNullable<SurfaceBinding["view"]>["developmentField"]> | undefined {
  const view = object(value);
  if (!view || view.cwd !== expected.cwd || (view.baseRevision ?? "HEAD") !== expected.requestedBase) return undefined;
  const snapshot = exactDevelopmentFieldSnapshot(view.snapshot, expected);
  const baseRevision = typeof view.baseRevision === "string" ? view.baseRevision : undefined;
  if (snapshot) return {cwd: expected.cwd, baseRevision, snapshot};
  const notice = view.snapshotUnavailable;
  if (typeof notice === "string" && notice.trim() && notice.length <= 1024) return {cwd: expected.cwd, baseRevision, snapshotUnavailable: notice};
  return undefined;
}
