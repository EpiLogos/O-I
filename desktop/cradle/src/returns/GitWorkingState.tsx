import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {kernelOp} from "../kernel/bridge";
import {useKernel} from "../kernel/KernelProvider";
import type {DevelopmentFieldReading} from "../kernel/types";
import {developmentFieldSnapshotError, exactDevelopmentFieldSnapshot, type DevelopmentFieldSnapshotIdentity} from "../surface/development-field-snapshot";
import type {DevelopmentFieldViewSnapshot} from "../surface/types";
import {ReturnedDocument} from "./ReturnedDocument";
import {developmentFieldGitDocument, developmentFieldWorktreeMismatch} from "./git";
import {NativeGitChangeBody} from "./git-patch";
import "./returned-document.css";
import "./git-working-state.css";

export interface GitWorkingStateProps {
  project: string;
  cwd: string;
  /** The explicit native comparison basis. HEAD means uncommitted working changes. */
  baseRevision?: string;
  /** A validated presentation snapshot carried with this exact Surface binding. */
  snapshot?: DevelopmentFieldViewSnapshot;
  /** A persisted notice when the prior response could not cross a presentation boundary. */
  snapshotUnavailable?: string;
  /** Persists a successful owner read or a bounded-snapshot refusal through the existing view transport. */
  onSnapshot?: (snapshot: DevelopmentFieldViewSnapshot | undefined, unavailable?: string) => void | Promise<void>;
}

interface ReviewedGitReading { identity: string; reading: DevelopmentFieldReading; resolvedBase?: string; }
interface GitReadFailure { identity: string; message: string; }

function snapshotIdentity(project: string, cwd: string, requestedBase: string): DevelopmentFieldSnapshotIdentity { return {project, cwd, requestedBase}; }
function reviewFromSnapshot(snapshot: DevelopmentFieldViewSnapshot | undefined, expected: DevelopmentFieldSnapshotIdentity): ReviewedGitReading | undefined {
  const exact = exactDevelopmentFieldSnapshot(snapshot, expected);
  return exact ? {identity: [expected.project, expected.cwd, expected.requestedBase].join("\u0000"), reading: exact.reading, resolvedBase: exact.resolvedBase} : undefined;
}
function unavailableSnapshotMessage(snapshot: DevelopmentFieldViewSnapshot | undefined, supplied: string | undefined, expected: DevelopmentFieldSnapshotIdentity): string | undefined {
  if (reviewFromSnapshot(snapshot, expected)) return undefined;
  if (supplied) return supplied;
  const error = snapshot === undefined ? undefined : developmentFieldSnapshotError(snapshot, expected);
  return error ? `The retained native Git reading cannot be shown: ${error}. Refresh explicitly to read the current worktree.` : undefined;
}

/**
 * A read-only review surface for AIKit's public Development Field Git reading.
 * For the default HEAD view it asks AIKit for HEAD, then uses AIKit's returned
 * observed HEAD as the exact second-read base. It never invokes Git itself.
 */
export function GitWorkingState({project, cwd, baseRevision = "HEAD", snapshot, snapshotUnavailable, onSnapshot}: GitWorkingStateProps) {
  const {transport} = useKernel();
  const requested = useMemo(() => snapshotIdentity(project, cwd, baseRevision), [project, cwd, baseRevision]);
  const identity = [project, cwd, baseRevision].join("\u0000");
  const initial = reviewFromSnapshot(snapshot, requested);
  const [reviewed, setReviewed] = useState<ReviewedGitReading | undefined>(initial);
  const [failure, setFailure] = useState<GitReadFailure | undefined>(() => {
    const message = unavailableSnapshotMessage(snapshot, snapshotUnavailable, requested);
    return message ? {identity, message} : undefined;
  });
  const [pending, setPending] = useState(!initial && !unavailableSnapshotMessage(snapshot, snapshotUnavailable, requested));
  const generation = useRef(0);
  const reviewedRef = useRef<ReviewedGitReading | undefined>(initial);
  const onSnapshotRef = useRef(onSnapshot);
  const requestedRef = useRef(requested);
  onSnapshotRef.current = onSnapshot;
  requestedRef.current = requested;

  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    const current = () => generation.current === requestGeneration;
    const retained = () => reviewedRef.current?.identity === identity;
    const showFailure = (message: string) => {
      if (!current()) return;
      setFailure({identity, message: retained() ? `${message} The previously returned native reading remains under review.` : message});
    };
    const retainUnavailable = (message: string) => {
      showFailure(message);
      const handover = onSnapshotRef.current;
      if (handover) void Promise.resolve(handover(undefined, message)).catch(error => {
        if (current()) showFailure(`${message} Its presentation notice could not be retained: ${String(error)}.`);
      });
    };
    setPending(true);
    setFailure(undefined);
    const read = (base: string) => kernelOp(transport, {op: "development_field_read" as const, project, cwd, base_revision: base, refs: []});
    try {
      const initialRead = await read(baseRevision);
      if (!current()) return;
      if (initialRead.outcome?.result !== "development_field_reading") { showFailure(initialRead.error ?? "AIKit did not serve a Development Field Git reading."); return; }
      if (initialRead.outcome.project !== project || initialRead.outcome.cwd !== cwd) { showFailure("AIKit returned a Development Field Git reading for a different Project or worktree."); return; }
      let finalReading = initialRead.outcome.reading;
      let resolvedBase: string | undefined;
      if (baseRevision === "HEAD") {
        resolvedBase = finalReading.git?.current_diff_from_base?.observed_head;
        if (!resolvedBase) { showFailure("AIKit served the HEAD probe but did not disclose an observed HEAD for an exact-base review."); return; }
        const exact = await read(resolvedBase);
        if (!current()) return;
        if (exact.outcome?.result !== "development_field_reading") { showFailure(exact.error ?? "AIKit served the HEAD probe but not the exact-base review."); return; }
        if (exact.outcome.project !== project || exact.outcome.cwd !== cwd) { showFailure("AIKit returned the exact-base Git reading for a different Project or worktree."); return; }
        finalReading = exact.outcome.reading;
      }
      if (!current()) return;
      const next = {identity, reading: finalReading, resolvedBase};
      reviewedRef.current = next;
      setReviewed(next);
      setFailure(undefined);
      const retainedSnapshot: DevelopmentFieldViewSnapshot = {...requested, resolvedBase, reading: finalReading};
      const snapshotError = developmentFieldSnapshotError(retainedSnapshot, requested);
      if (snapshotError) {
        retainUnavailable(`AIKit returned a reading that remains visible here, but it cannot be retained across presentation changes: ${snapshotError}.`);
      } else if (onSnapshotRef.current) {
        void Promise.resolve(onSnapshotRef.current(retainedSnapshot)).catch(error => {
          if (current() && reviewedRef.current === next) showFailure(`AIKit returned a reading that remains visible here, but the presentation snapshot could not be retained: ${String(error)}.`);
        });
      }
    } catch (error) { showFailure(`AIKit Git refresh failed: ${String(error)}`); }
    finally { if (current()) setPending(false); }
  }, [baseRevision, cwd, identity, project, requested, transport]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const expected = requestedRef.current;
    const seeded = reviewFromSnapshot(snapshot, expected);
    const unavailable = unavailableSnapshotMessage(snapshot, snapshotUnavailable, expected);
    generation.current += 1;
    // A same-identity marker is emitted only after this mounted surface has
    // retained a real owner response but cannot carry it through a later
    // presentation boundary. Keep that response visible here; a new mount has
    // no in-memory review and therefore shows the marker plus explicit Refresh.
    const retainInMemoryReview = !seeded && !!unavailable && reviewedRef.current?.identity === identity;
    if (seeded) {
      reviewedRef.current = seeded;
      setReviewed(seeded);
    } else if (!retainInMemoryReview) {
      reviewedRef.current = undefined;
      setReviewed(undefined);
    }
    setFailure(unavailable ? {identity, message: unavailable} : undefined);
    if (seeded || unavailable) {
      setPending(false);
      return () => { generation.current += 1; };
    }
    setPending(true);
    void refreshRef.current();
    return () => { generation.current += 1; };
  }, [identity, snapshot, snapshotUnavailable]);

  const visibleReviewed = reviewed?.identity === identity ? reviewed : undefined;
  const visibleFailure = failure?.identity === identity ? failure.message : undefined;
  const reading = visibleReviewed?.reading;
  const mismatch = reading ? developmentFieldWorktreeMismatch(reading, cwd) : undefined;
  const diff = reading?.git?.current_diff_from_base;
  const patchMayRender = !!diff && !mismatch && !!reading?.git?.world.repository.worktree_root && diff.base_revision === (visibleReviewed?.resolvedBase ?? baseRevision);
  const displayedBase = diff?.base_revision ?? visibleReviewed?.resolvedBase ?? baseRevision;
  const patchBody = diff && patchMayRender ? <NativeGitChangeBody diff={diff} working={reading.git!.world.working}/> : undefined;
  return <section className="git-working-state" aria-label="Uncommitted working changes" aria-busy={pending}>
    <header className="git-working-state-header"><details><summary>Comparison basis</summary><p>Requested worktree <code>{cwd}</code> against <code>{displayedBase}</code>.</p></details><button type="button" onClick={() => void refresh()} disabled={pending}>{pending ? "Reading..." : "Refresh"}</button></header>
    {visibleFailure && <p className="git-working-state-failure" role="alert">{visibleFailure}</p>}
    {mismatch && <section className="git-working-state-mismatch" role="alert" data-git-worktree-mismatch="true"><h3>Native Git observation is for another worktree</h3><p>Requested <code>{mismatch.requested}</code>; AIKit reported <code>{mismatch.observed}</code>. The native patch is withheld because it cannot be presented as a diff for the requested worktree.</p></section>}
    {reading && <ReturnedDocument reading={developmentFieldGitDocument(reading)} body={patchBody}/>}
    {reading && !mismatch && !patchMayRender && <p className="git-working-state-empty">AIKit did not disclose an exact native difference for this basis.</p>}
  </section>;
}
