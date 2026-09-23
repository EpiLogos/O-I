/**
 * The pending strip and the ONE review sheet (12-SETTINGS §2, S3–S9).
 *
 * The strip exists only while something is staged ("2 changes pending ·
 * Review changes · Discard") — at rest it is absent from the DOM (S3). The
 * sheet lists each change: setting, scope, from → to and its effect in plain
 * words (S5). Apply changes plans again, refuses as stale when anything
 * moved since review (S8), applies, reads the owners back and marks each row
 * Applied ✓ only when the readback matches (S6) — otherwise the owner's
 * reason (S7). A review with nothing staged says "No capability changes." (S9).
 */
import {useEffect, useRef, useState} from "react";
import {applyReviewed, discardAll, review, type ApplyOutcome, type ReviewedPlan, type StagedChange} from "./changeModel";
import {plain} from "./settingsData";
import {goTo} from "./settingsNav";
import {Scrim} from "./rows";

export function PendingStrip({changes, onReview}: {changes: StagedChange[]; onReview: () => void}) {
  const [busy, setBusy] = useState(false);
  if (changes.length === 0) return null;
  return <div className="settings-pending" role="region" aria-label="Pending changes" data-settings-pending>
    <strong data-settings-pending-count>{changes.length} {changes.length === 1 ? "change" : "changes"} pending</strong>
    <button type="button" className="settings-button is-primary" data-settings-review onClick={onReview}>Review changes</button>
    <button type="button" className="settings-button" data-settings-discard disabled={busy} onClick={() => { setBusy(true); void discardAll(changes).finally(() => setBusy(false)); }}>Discard</button>
  </div>;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
}

export function ReviewSheet({changes, onClose}: {changes: StagedChange[]; onClose: () => void}) {
  const [reviewed, setReviewed] = useState<ReviewedPlan | null>(null);
  const [phase, setPhase] = useState<"planning" | "ready" | "applying" | "done">("planning");
  const [outcome, setOutcome] = useState<ApplyOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const plan = async () => {
    setPhase("planning"); setError(null); setOutcome(null);
    try {
      setReviewed(await review());
      setPhase("ready");
    } catch (cause) {
      setError(plain(cause));
      setPhase("ready");
    }
  };
  useEffect(() => { void plan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    sheet.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && phase !== "applying") { event.stopPropagation(); event.preventDefault(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [phase, onClose]);
  const apply = async () => {
    if (!reviewed) return;
    setPhase("applying");
    const result = await applyReviewed(reviewed);
    setOutcome(result);
    setPhase(result.kind === "stale" ? "ready" : "done");
  };
  const rows = reviewed?.changes ?? changes;
  const results = outcome?.kind === "applied" ? outcome.rows : null;
  const nothing = phase !== "planning" && rows.length === 0;
  return <Scrim data-settings-scrim>
    <div ref={sheet} tabIndex={-1} className="settings-sheet settings-review oi-scroll-quiet" role="dialog" aria-modal="true" aria-labelledby="settings-review-title" data-settings-review-sheet data-phase={phase}>
      <header className="settings-sheet-head"><h2 id="settings-review-title">{nothing ? "Review changes" : `Review ${rows.length} ${rows.length === 1 ? "change" : "changes"}`}</h2></header>
      {nothing && <p data-review-empty>No capability changes.</p>}
      {error && <p className="settings-inline-error" role="alert" data-review-error>Couldn't load these settings. {error}</p>}
      <ul className="settings-review-list">
        {rows.map((change) => {
          const refusal = reviewed?.refusals[change.requestKey];
          const result = results?.[change.key];
          return <li key={change.key} className="settings-review-row" data-review-row={change.key} data-review-state={result?.state ?? (refusal ? "refused" : "planned")}>
            <div className="settings-review-main">
              <button type="button" className="settings-review-title" onClick={() => { onClose(); goTo(change.place, change.rowId); }}>{change.title}</button>
              <span className="settings-review-detail" data-review-detail>{change.scopeLabel} · {change.from} → {change.to}</span>
              {result?.state === "applied" && <span className="settings-review-result is-applied" data-review-result="applied">Applied ✓</span>}
              {result?.state === "partial" && <span className="settings-review-result is-partial" data-review-result="partial">Partly applied — {result.reason}</span>}
              {result?.state === "refused" && <span className="settings-review-result is-refused" data-review-result="refused">This change wasn't applied. {result.reason}</span>}
              {!result && refusal && <span className="settings-review-result is-refused" data-review-refusal>The owner refuses this change: {refusal}</span>}
            </div>
            <span className="settings-review-effect" data-review-effect={change.effectKind}>{change.effect}</span>
          </li>;
        })}
      </ul>
      {outcome?.kind === "stale" && <p className="settings-inline-error" role="alert" data-review-stale>These settings changed. Review the plan again.</p>}
      {outcome?.kind === "failed" && <p className="settings-inline-error" role="alert" data-review-failed>This change wasn't applied. {outcome.error}</p>}
      {outcome?.kind === "applied" && <p className="settings-review-receipt" role="status" data-review-receipt>
        {outcome.appliedCount === outcome.total ? `Applied ${outcome.total} ${outcome.total === 1 ? "change" : "changes"}` : `Applied ${outcome.appliedCount} of ${outcome.total} changes`} · read back {clock(outcome.readAt)}
      </p>}
      <footer className="settings-sheet-foot">
        {phase === "done" || nothing
          ? <><span className="settings-muted">Each change was read back from its owner.</span><button type="button" className="settings-button is-primary" data-review-close onClick={onClose}>Done</button></>
          : outcome?.kind === "stale"
            ? <><span className="settings-muted">Nothing was applied.</span><button type="button" className="settings-button" onClick={onClose}>Keep editing</button><button type="button" className="settings-button is-primary" data-review-again onClick={() => void plan()}>Review again</button></>
            : <><span className="settings-muted">Nothing is written until you apply. Each change is read back after.</span>
                <button type="button" className="settings-button" data-review-keep-editing disabled={phase === "applying"} onClick={onClose}>Keep editing</button>
                <button type="button" className="settings-button is-primary" data-review-apply disabled={phase !== "ready" || !reviewed} onClick={() => void apply()}>{phase === "applying" ? "Applying…" : phase === "planning" ? "Reading plans…" : "Apply changes"}</button></>}
      </footer>
    </div>
  </Scrim>;
}
