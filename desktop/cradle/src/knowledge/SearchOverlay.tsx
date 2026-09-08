import { useEffect, useRef, useState } from "react";
import { useKernel } from "../kernel/KernelProvider";
import type { KnowledgeAddress, KnowledgeHit } from "../kernel/types";
import { knowledge } from "./client";
import { searchLeaderLabel } from "./leader";
import "./knowledge.css";

export function SearchOverlay({project,onClose,onOpen,leader,onLeaderChange,shortcutError}: {leader:boolean;onLeaderChange:(shift:boolean)=>void;shortcutError?:string;project?:string;onClose:()=>void;onOpen:(address:KnowledgeAddress,title:string,project?:string)=>Promise<void>}) {
  const {transport}=useKernel(); const dialog=useRef<HTMLDialogElement>(null);
  const [query,setQuery]=useState(""); const [hits,setHits]=useState<KnowledgeHit[]>([]);
  const [absences,setAbsences]=useState<string[]>([]); const [error,setError]=useState<string>();
  const [busy,setBusy]=useState(false); const [detail,setDetail]=useState<unknown>();
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous?.isConnected)previous.focus();};},[]);
  useEffect(()=>{let active=true;setBusy(true);setError(undefined);const timer=setTimeout(()=>{void knowledge<{hits:KnowledgeHit[];absences:string[]}>(transport,project,{action:"search",query}).then(r=>{if(active){setHits(r.hits);setAbsences(r.absences);}}).catch(e=>{if(active){setError(String(e));setHits([]);}}).finally(()=>{if(active)setBusy(false);});},180);return()=>{active=false;clearTimeout(timer);};},[query,project,transport]);
  const open=async(hit:KnowledgeHit)=>{setError(undefined);try{await onOpen(hit.address,hit.label,project);onClose();}catch(e){setError(String(e));}};
  return <dialog ref={dialog} className="search-aperture" aria-label="Search Central" onKeyDownCapture={e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();onClose();}}} onCancel={e=>{e.preventDefault();onClose();}}>
    <form onSubmit={e=>{e.preventDefault();if(!busy&&hits[0])void open(hits[0]);}}><input spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" autoFocus aria-label="Search or resolve" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${project ?? "Central"}`} /><button type="button" onClick={onClose}>Esc</button></form>
    <header><span>AIKit · {project ?? "Central"}</span><button onClick={()=>{void knowledge(transport,project,{action:"history"}).then(setDetail).catch(e=>setError(String(e)));}}>History</button></header>
    <label className="search-shortcut">Shortcut <select aria-label="Search shortcut" value={String(leader)} onChange={e=>onLeaderChange(e.target.value==="true")}><option value="false">{searchLeaderLabel(false)}</option><option value="true">{searchLeaderLabel(true)}</option></select></label>
    {shortcutError&&<p role="alert">{shortcutError}</p>}
    {busy&&<p role="status">Resolving…</p>}{error&&<p role="alert">{error}</p>}
    <ul aria-label="Search results" aria-busy={busy}>{hits.map(hit=><li key={hit.resource}><button disabled={busy} onClick={()=>void open(hit)}><strong>{hit.label}</strong><small>{hit.kind} · {hit.snippet}</small></button><button aria-label={`Explain ${hit.label}`} onClick={()=>{void knowledge(transport,project,{action:"explain",address:hit.address}).then(setDetail).catch(e=>setError(String(e)));}}>Explain</button></li>)}</ul>
    {!busy&&!hits.length&&!error&&<p>No results in the available native sources.</p>}
    {absences.length>0&&<details><summary>Unavailable sources ({absences.length})</summary>{absences.map(a=><p key={a}>{a}</p>)}</details>}
    {detail!==undefined&&<details open><summary>Owner evidence</summary><pre>{JSON.stringify(detail,null,2)}</pre></details>}
  </dialog>;
}
