import {useCallback, useEffect, useRef, useState} from "react";
import {kernelOp} from "../kernel/bridge";
import {useKernel} from "../kernel/KernelProvider";
import type {DevelopmentFieldReading} from "../kernel/types";
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
}

interface ReviewedGitReading {
  identity: string;
  reading: DevelopmentFieldReading;
  resolvedBase?: string;
}

interface GitReadFailure {
  identity: string;
  message: string;
}

/**
 * A read-only review surface for AIKit's public Development Field Git reading.
 * For the default HEAD view it asks AIKit for HEAD, then uses AIKit's returned
 * observed HEAD as the exact second-read base. It never invokes Git itself.
 */
export function GitWorkingState({project, cwd, baseRevision = "HEAD"}: GitWorkingStateProps) {
  const {transport} = useKernel();
  const identity = [project, cwd, baseRevision].join("\u0000");
  const [reviewed, setReviewed] = useState<ReviewedGitReading>();
  const [failure, setFailure] = useState<GitReadFailure>();
  const [pending, setPending] = useState(true);
  const generation = useRef(0);
  const reviewedRef = useRef<ReviewedGitReading>();

  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    const current = () => generation.current === requestGeneration;
    const retained = () => reviewedRef.current?.identity === identity;
    const showFailure = (message: string) => {
      if (!current()) return;
      setFailure({
        identity,
        message: retained() ? `${message} The previously returned native reading remains under review.` : message,
      });
    };
    setPending(true);
    setFailure(undefined);
    const read = (base: string) => kernelOp(transport, {
      op: "development_field_read" as const,
      project,
      cwd,
      base_revision: base,
      refs: [],
    });
    try {
      const initial = await read(baseRevision);
      if (!current()) return;
      if (initial.outcome?.result !== "development_field_reading") {
        showFailure(initial.error ?? "AIKit did not serve a Development Field Git reading.");
        return;
      }
      let finalReading = initial.outcome.reading;
      let exactBase: string | undefined;
      if (baseRevision === "HEAD") {
        exactBase = finalReading.git?.current_diff_from_base?.observed_head;
        if (!exactBase) {
          showFailure("AIKit served the HEAD probe but did not disclose an observed HEAD for an exact-base review.");
          return;
        }
        const exact = await read(exactBase);
        if (!current()) return;
        if (exact.outcome?.result !== "development_field_reading") {
          showFailure(exact.error ?? "AIKit served the HEAD probe but not the exact-base review.");
          return;
        }
        finalReading = exact.outcome.reading;
      }
      if (!current()) return;
      const next = {identity, reading: finalReading, resolvedBase: exactBase};
      reviewedRef.current = next;
      setReviewed(next);
      setFailure(undefined);
    } catch (error) {
      showFailure(`AIKit Git refresh failed: ${String(error)}`);
    } finally {
      if (current()) setPending(false);
    }
  }, [baseRevision, cwd, identity, project, transport]);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  const visibleReviewed = reviewed?.identity === identity ? reviewed : undefined;
  const visibleFailure = failure?.identity === identity ? failure.message : undefined;
  const reading = visibleReviewed?.reading;
  const mismatch = reading ? developmentFieldWorktreeMismatch(reading, cwd) : undefined;
  const diff = reading?.git?.current_diff_from_base;
  const patchMayRender = !!diff && !mismatch && !!reading?.git?.world.repository.worktree_root && diff.base_revision === (visibleReviewed?.resolvedBase ?? baseRevision);
  const displayedBase = diff?.base_revision ?? visibleReviewed?.resolvedBase ?? baseRevision;
  const patchBody = diff && patchMayRender ? <NativeGitChangeBody diff={diff} working={reading.git!.world.working}/> : undefined;
  return <section className="git-working-state" aria-label="Uncommitted working changes" aria-busy={pending}>
    <header className="git-working-state-header">
      <details><summary>Comparison basis</summary><p>Requested worktree <code>{cwd}</code> against <code>{displayedBase}</code>.</p></details>
      <button type="button" onClick={() => void refresh()} disabled={pending}>{pending ? "Reading..." : "Refresh"}</button>
    </header>
    {visibleFailure && <p className="git-working-state-failure" role="alert">{visibleFailure}</p>}
    {mismatch && <section className="git-working-state-mismatch" role="alert" data-git-worktree-mismatch="true">
      <h3>Native Git observation is for another worktree</h3>
      <p>Requested <code>{mismatch.requested}</code>; AIKit reported <code>{mismatch.observed}</code>. The native patch is withheld because it cannot be presented as a diff for the requested worktree.</p>
    </section>}
    {reading && <ReturnedDocument reading={developmentFieldGitDocument(reading)} body={patchBody}/>}
    {reading && !mismatch && !patchMayRender && <p className="git-working-state-empty">AIKit did not disclose an exact native difference for this basis.</p>}
  </section>;
}
