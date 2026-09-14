import { useEffect, useState } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import { inspectProjectInbox, inspectProjectNow, type ProjectNowInspection } from "./client";
import type { ReceivingPage } from "../../receiving/client";
import "./project-now.css";

export interface ProjectNowSurfaceProps {
  project: string;
  projectRef: string;
  onOpenProjectNow?: (nowRef: string) => Promise<void>;
  onOpenDay?: (path: string) => Promise<void>;
}

export function ProjectNowSurface({ project, projectRef, onOpenProjectNow, onOpenDay }: ProjectNowSurfaceProps) {
  const kernel = useKernel();
  const [reading, setReading] = useState<ProjectNowInspection>();
  const [inbox, setInbox] = useState<ReceivingPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(undefined); setReading(undefined); setInbox(undefined);
    void Promise.all([inspectProjectNow(kernel.transport, project, projectRef), inspectProjectInbox(kernel.transport, project)])
      .then(([now, returns]) => { if (live) { setReading(now); setInbox(returns); } })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [kernel.transport, project, projectRef, refresh]);
  return <section className="project-now-surface" aria-label="Project NOW and Inbox">
    <header><div><h2>Project NOW</h2><p>Current work, today’s records, and received returns for {projectRef}.</p></div><button onClick={() => setRefresh(value => value + 1)} disabled={loading}>Refresh</button></header>
    {loading && <p role="status">Reading the Project field…</p>}
    {error && <p role="alert">{error}</p>}
    {reading && <>
      <section aria-label="Active work"><h3>Active work <small>{reading.active_items.length}</small></h3>{reading.active_items.length ? <ul>{reading.active_items.map(item => <li key={item.id}>{item.now_ref && onOpenProjectNow ? <button onClick={() => void onOpenProjectNow(item.now_ref!)}><strong>{item.subject}</strong></button> : <strong>{item.subject}</strong>}<span>{item.kind} · {item.status}</span><small>{item.id}</small></li>)}</ul> : <p>No active Project NOW items.</p>}</section>
      <section aria-label="DAY records"><h3>DAY records <small>{reading.day_records.length}</small></h3>{reading.day_records.length ? <ul>{reading.day_records.map(path => { const date = path.match(/(\d{4}-\d{2}-\d{2})/)?.[1]; return <li key={path}>{onOpenDay ? <button onClick={() => void onOpenDay(path)}><strong>{date ? `DAY ${date}` : "Open DAY record"}</strong></button> : <strong>{date ? `DAY ${date}` : "DAY record"}</strong>}<code>{path}</code></li>; })}</ul> : <p>No Project DAY records disclosed.</p>}</section>
      <section aria-label="Human scratch and open questions"><h3>Open questions <small>{reading.open_questions.length}</small></h3>{reading.open_questions.length ? <ul>{reading.open_questions.map((item, index) => <li key={index}><span>{typeof item === "string" ? item : JSON.stringify(item)}</span></li>)}</ul> : <p>No open questions disclosed.</p>}{reading.human_scratch.length > 0 && <p>Human scratch is present in the owner field.</p>}</section><details><summary>Project field boundaries</summary><ul>{(reading.boundaries ?? []).map(boundary => <li key={boundary}>{boundary}</li>)}</ul></details>
    </>}
    {inbox && <section aria-label="Project Inbox"><h3>Inbox <small>{inbox.returns.length}</small></h3>{inbox.returns.length ? <ul>{inbox.returns.map(row => <li key={row.return_ref}><strong>{row.status}</strong><span>{row.document_id}</span><small>{row.return_ref} · {row.author.actor_kind}</small></li>)}</ul> : <p>Inbox is clear.</p>}</section>}
  </section>;
}
