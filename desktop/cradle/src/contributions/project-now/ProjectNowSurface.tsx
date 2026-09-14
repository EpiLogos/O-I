import {listFiles} from "../../files/client";
import type {CentralLocation} from "../../kernel/types";
import { useEffect, useState } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import { inspectProjectInbox, inspectProjectNow, type ProjectNowInspection } from "./client";
import type { ReceivingPage } from "../../receiving/client";
import "./project-now.css";

export interface ProjectNowSurfaceProps {
  project: string;
  projectRef: string;
  onOpenProjectNow?: (nowRef: string) => Promise<void>;
  onOpenFile?: (location:CentralLocation)=>Promise<void>;
}

export function ProjectNowSurface({ project, projectRef, onOpenProjectNow, onOpenFile }: ProjectNowSurfaceProps) {
  const kernel = useKernel();
  const [reading, setReading] = useState<ProjectNowInspection>();
  const [inbox, setInbox] = useState<ReceivingPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(undefined); setReading(undefined); setInbox(undefined);
    void Promise.allSettled([inspectProjectNow(kernel.transport, project), inspectProjectInbox(kernel.transport, project)])
      .then(([now, returns]) => {
        if (!live) return;
        if (now.status === "fulfilled") setReading(now.value);
        if (returns.status === "fulfilled") setInbox(returns.value);
        const errors = [now.status === "rejected" ? `NOW: ${String(now.reason)}` : "", returns.status === "rejected" ? `Inbox: ${String(returns.reason)}` : ""].filter(Boolean);
        setError(errors.length ? errors.join(" · ") : undefined);
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [kernel.transport, project, projectRef, refresh]);
  const onOpenDay=onOpenFile?async(path:string)=>{
    if(!reading?.project_root||!reading.day_records.includes(path)||path.startsWith("/")||path.split("/").includes(".."))throw new Error("Central did not disclose this Project DAY file");
    const slash=path.lastIndexOf("/"),name=path.slice(slash+1);
    const root=kernel.snapshot.navigator?.root?.root?.replace(/\/$/,"");
    if(!root||!reading.project_root.startsWith(`${root}/`))throw new Error("Central did not disclose this Project under the current file root");
    const projectPath=reading.project_root.slice(root.length+1);
    const directory=await listFiles(kernel.transport,`${projectPath}/${path.slice(0,slash)}`);
    const file=directory.entries.find(entry=>entry.name===name&&entry.kind==="file");
    if(!file)throw new Error("The disclosed DAY file is no longer available");
    await onOpenFile(file.location);
  }:undefined;
  return <section className="project-now-surface" aria-label="Project NOW and Inbox">
    <header><div><h2>{project} · NOW</h2></div><button onClick={() => setRefresh(value => value + 1)} disabled={loading}>Refresh</button></header>
    {loading && <p role="status">Reading the Project field…</p>}
    {error && <p role="alert">{error}</p>}
    {reading && <>
      <section aria-label="Active work"><h3>Active work <small>{reading.active_items.length}</small></h3>{reading.active_items.length ? <ul>{reading.active_items.map(item => <li key={item.id}>{item.now_ref && onOpenProjectNow ? <button onClick={() => void onOpenProjectNow(item.now_ref!).catch(reason=>setError(String(reason)))}><strong>{item.subject}</strong></button> : <strong>{item.subject}</strong>}<span>{item.kind} · {item.status}</span>{item.result&&<details><summary>Read handoff</summary><p>{item.result}</p><small>{item.actor}</small><code>{item.id}</code></details>}</li>)}</ul> : <p>No active Project NOW items.</p>}</section>
      <section aria-label="DAY records"><h3>DAY records <small>{reading.day_records.length}</small></h3>{reading.day_records.length ? <ul>{reading.day_records.map(path => { const date = path.match(/(\d{4}-\d{2}-\d{2})/)?.[1]; return <li key={path}>{onOpenDay ? <button onClick={() => void onOpenDay(path).catch(reason=>setError(String(reason)))}><strong>{date ? `DAY ${date}` : "Open DAY record"}</strong></button> : <strong>{date ? `DAY ${date}` : "DAY record"}</strong>}<code>{path}</code></li>; })}</ul> : <p>No Project DAY records disclosed.</p>}</section>
      <section aria-label="Human scratch and open questions"><h3>Open questions <small>{reading.open_questions.length}</small></h3>{reading.open_questions.length ? <ul>{reading.open_questions.map((item, index) => <li key={index}><span>{typeof item === "string" ? item : JSON.stringify(item)}</span></li>)}</ul> : <p>No open questions disclosed.</p>}{reading.human_scratch.length > 0 && <p>Human scratch is present in the owner field.</p>}</section><details><summary>Project field boundaries</summary><ul>{(reading.boundaries ?? []).map(boundary => <li key={boundary}>{boundary}</li>)}</ul></details>
    </>}
    {inbox && <section aria-label="Project Inbox"><h3>Inbox <small>{inbox.returns.length}</small></h3>{inbox.returns.length ? <ul>{inbox.returns.map(row => <li key={row.return_ref}><strong>{row.status}</strong><span>{row.document_id}</span><small>{row.return_ref} · {row.author.actor_kind}</small></li>)}</ul> : <p>Inbox is clear.</p>}</section>}
  </section>;
}
