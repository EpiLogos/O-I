import { useEffect, useState } from "react";
import { useKernel } from "../kernel/KernelProvider";
import type { SourceHistoryReading } from "../kernel/types";
import { Loading } from "../shared/Loading";

export function SourceHistory({ sourceRef, revision }: { sourceRef: string; revision: string }) {
  const { apply } = useKernel();
  const [reading, setReading] = useState<SourceHistoryReading | null>(null);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    setPending(true);
    // BOOT-14: keep the last-observed history rows visible through a
    // refresh/ref change — `reading` is replaced only once the new read
    // actually lands, never blanked first.
    setFailed(false);
    void apply({ op: "source_history", source_ref: sourceRef }).then(result => {
      if (!alive) return;
      if (result?.result === "source_history") { setReading(result.history); setFailed(false); }
      else setFailed(true);
      setPending(false);
    });
    return () => { alive = false; };
  }, [apply, sourceRef, revision, refresh]);
  return <section className="source-history" aria-label="Source history" aria-busy={pending}>
    <div className="source-history-heading"><h2>Recorded changes</h2>
      <button onClick={() => setRefresh(n => n + 1)} disabled={pending}>Refresh history</button></div>
    <p className="source-note source-note-muted">Changes retained by Central’s source horizon. Earlier records may have been compacted.</p>
    {pending && <Loading label={reading ? "Refreshing history…" : "Reading history…"} scope="surface" />}
    {failed && <p role="status">History could not be read. Refresh to retry.</p>}
    {reading && <ol className="source-history-rows">
      {reading.changes.map(change => <li key={change.change_ref} data-change-ref={change.change_ref} data-source-ref={change.source_ref}>
        <span>{change.kind} · {change.actor ?? "Actor not recorded"}</span>
        <time dateTime={new Date(change.observed_at_unix_seconds * 1000).toISOString()}>{new Date(change.observed_at_unix_seconds * 1000).toLocaleString()}</time>
        <details><summary>Revision and provenance</summary>
          <dl><dt>Before</dt><dd>{change.before_revision ?? "No prior revision"}</dd>
          <dt>After</dt><dd>{change.after_revision ?? "Source removed"}</dd>
          <dt>Change</dt><dd>{change.change_ref}</dd>
          <dt>Actor kind</dt><dd>{change.actor_kind ?? "Not recorded"}</dd>
          {change.agent_session_ref && <><dt>Agent session</dt><dd>{change.agent_session_ref}</dd></>}</dl>
        </details>
      </li>)}
    </ol>}
    {reading && !reading.changes.length && <p>No retained changes for this source.</p>}
  </section>;
}
