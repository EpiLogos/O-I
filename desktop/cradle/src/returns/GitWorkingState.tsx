import {useCallback, useEffect, useRef, useState} from "react";
import {kernelOp} from "../kernel/bridge";
import {useKernel} from "../kernel/KernelProvider";
import type {DevelopmentFieldCurrentDiff, DevelopmentFieldReading} from "../kernel/types";
import {ReturnedDocument} from "./ReturnedDocument";
import {developmentFieldGitDocument, developmentFieldWorktreeMismatch} from "./git";
import "./returned-document.css";

export interface GitWorkingStateProps {
  project: string;
  cwd: string;
  /** The explicit native comparison basis. HEAD means uncommitted working changes. */
  baseRevision?: string;
}

/**
 * A read-only review surface for AIKit's public Development Field Git reading.
 * For the default HEAD view it asks AIKit for HEAD, then uses AIKit's returned
 * observed HEAD as the exact second-read base. It never invokes Git itself.
 */
export function GitWorkingState({project, cwd, baseRevision = "HEAD"}: GitWorkingStateProps) {
  const {transport} = useKernel();
  const [reading, setReading] = useState<DevelopmentFieldReading>();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(true);
  const [resolvedBase, setResolvedBase] = useState<string>();
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    const current = () => generation.current === requestGeneration;
    setPending(true);
    setReading(undefined);
    setFailure(undefined);
    setResolvedBase(undefined);
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
        setFailure(initial.error ?? "AIKit did not serve a Development Field Git reading.");
        return;
      }
      let finalReading = initial.outcome.reading;
      let exactBase: string | undefined;
      if (baseRevision === "HEAD") {
        exactBase = finalReading.git?.current_diff_from_base?.observed_head;
        if (!exactBase) {
          setReading(finalReading);
          setFailure("AIKit served the HEAD probe but did not disclose an observed HEAD for an exact-base review.");
          return;
        }
        const exact = await read(exactBase);
        if (!current()) return;
        if (exact.outcome?.result !== "development_field_reading") {
          setReading(finalReading);
          setFailure(exact.error ?? "AIKit served the HEAD probe but not the exact-base review.");
          return;
        }
        finalReading = exact.outcome.reading;
      }
      if (!current()) return;
      setReading(finalReading);
      setResolvedBase(exactBase);
    } catch (error) {
      if (current()) setFailure(String(error));
    } finally {
      if (current()) setPending(false);
    }
  }, [baseRevision, cwd, project, transport]);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  const mismatch = reading ? developmentFieldWorktreeMismatch(reading, cwd) : undefined;
  const diff = reading?.git?.current_diff_from_base;
  const patchMayRender = !!diff && !mismatch && !!reading?.git?.world.repository.worktree_root && diff.base_revision === (resolvedBase ?? baseRevision);
  const displayedBase = diff?.base_revision ?? resolvedBase ?? baseRevision;
  const patchBody = diff && patchMayRender ? <NativePatch diff={diff}/> : undefined;
  return <section className="git-working-state" aria-label="Uncommitted working changes" aria-busy={pending}>
    <header className="git-working-state-header">
      <details><summary>Comparison basis</summary><p>Requested worktree <code>{cwd}</code> against <code>{displayedBase}</code>.</p></details>
      <button type="button" onClick={() => void refresh()} disabled={pending}>{pending ? "Reading..." : "Refresh"}</button>
    </header>
    {failure && <p className="git-working-state-failure" role="alert">{failure}</p>}
    {mismatch && <section className="git-working-state-mismatch" role="alert" data-git-worktree-mismatch="true">
      <h3>Native Git observation is for another worktree</h3>
      <p>Requested <code>{mismatch.requested}</code>; AIKit reported <code>{mismatch.observed}</code>. The native patch is withheld because it cannot be presented as a diff for the requested worktree.</p>
    </section>}
    {reading && <ReturnedDocument reading={developmentFieldGitDocument(reading)} body={patchBody}/>}
    {reading && !mismatch && !patchMayRender && <p className="git-working-state-empty">AIKit did not disclose an exact native difference for this basis.</p>}
  </section>;
}

function NativePatch({diff}: {diff: DevelopmentFieldCurrentDiff}) {
  return <section className="git-working-state-patch" aria-label="Native Git patch">
    <pre>{diff.patch || "AIKit returned no tracked patch for this basis."}</pre>
    {diff.untracked_paths.length > 0 && <p>Untracked paths: {diff.untracked_paths.map(path => <code key={path}>{path}</code>)}</p>}
    {diff.truncated && <p className="git-working-state-warning">AIKit truncated this patch. The displayed body is only the returned prefix.</p>}
  </section>;
}
